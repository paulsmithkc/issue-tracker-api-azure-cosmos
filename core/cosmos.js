import config from 'config';
import debug from 'debug';
import { CosmosClient, Database, Container } from '@azure/cosmos';

// create debug channels
const debugCosmos = debug('app:core:cosmos');

/**
 * Open a connection to our Cosmos database.
 * Also creates the database and/or containers if needed.
 * @returns {Promise<{
 *  client: CosmosClient,
 *  database: Database,
 *  issuesContainer: Container,
 *  projectsContainer: Container,
 *  usersContainer: Container
 * }>}
 */
async function connect() {
  // get cosmos configuration
  const { endpoint, key, databaseId } = config.get('cosmos');

  // create a client
  const client = new CosmosClient({ endpoint, key });

  // Create the database, if it does not exist
  const { database } = await client.databases.createIfNotExists({
    id: databaseId,
  });
  debugCosmos(`Created database: ${database.id}`);

  // Create the necessary containers
  const issuesContainer = await createContainer(database, 'Issues', ['/issueId']);
  const projectsContainer = await createContainer(database, 'Projects', ['/projectId']);
  const usersContainer = await createContainer(database, 'Users', ['/userId']);

  return {
    client,
    database,
    issuesContainer,
    projectsContainer,
    usersContainer,
  };
}

/**
 * Creates a new container in our Cosmos database.
 * @param {Database} database
 * @param {string} containerId
 * @param {string[]} partitionPaths
 * @returns {Promise<Container>}
 */
async function createContainer(database, containerId, partitionPaths) {
  const { container } = await database
    .containers.createIfNotExists(
      {
        id: containerId,
        partitionKey: { kind: 'Hash', paths: partitionPaths },
      },
      { offerThroughput: 400 }
    );
  debugCosmos(`Created container: ${container.id}`);
  return container;
}

/**
 * Fetches all items from a container and returns them as an array.
 * @param {Container} container
 * @returns {Promise<any[]>}
 */
async function getAllItemsFromContainer(container) {
  const querySpec = { query: 'SELECT * FROM c' };
  const query = container.items.query(querySpec);
  const { resources: items } = await query.fetchAll();
  return items;
}

/**
 * Fetches a specific item from a container.
 * @param {Container} container
 * @param {string} id
 * @returns {Promise<any>}
 * @deprecated Use readItemFromContainer instead.
 */
async function getItemByIdFromContainer(container, id) {
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.id = @id',
    parameters: [{ name: '@id', value: id }],
  };
  const query = container.items.query(querySpec);
  const { resources: items } = await query.fetchAll();
  return items && items.length ? items[0] : null;
}

/**
 * Fetches a specific item from a container.
 * @param {Container} container
 * @param {string} id
 * @param {string} partitionKey
 * @returns {Promise<any>}
 */
 async function readItemFromContainer(container, id, partitionKey) {
  const result = await container.item(id, partitionKey).read();
  debugCosmos('read', result);
  return result.resource;
}

/**
 * Add a new item to a container.
 * @param {Container} container
 * @param {any} newItem
 * @returns {Promise<any>}
 */
async function addItemToContainer(container, newItem) {
  const { resource } = await container.items.create(newItem);
  return resource;
}

/**
 * Replace an existing item within a container.
 * @param {Container} container
 * @param {string} id
 * @param {string} partitionKey
 * @param {any} body
 * @returns {Promise<any>}
 */
async function replaceItemInContainer(container, id, partitionKey, body) {
  // debugCosmos('replacing item', id, partitionKey, body)
  const { resource } = await container.item(id, partitionKey).replace(body);
  return resource;
}

/**
 * Remove an existing item from a container.
 * @param {Container} container
 * @param {string} id
 * @param {string} partitionKey
 * @returns {Promise<any>}
 */
async function removeItemFromContainer(container, id, partitionKey) {
  // debugCosmos('deleting item', id, partitionKey)
  const { resource } = await container.item(id, partitionKey).delete();
  return resource;
}

// open a connection
const { client, database, issuesContainer, projectsContainer, usersContainer } =
  await connect();

// export
export default {
  getAllIssues: () => getAllItemsFromContainer(issuesContainer),
  getIssueById: (id) => readItemFromContainer(issuesContainer, id, id),
  addIssue: (newItem) => addItemToContainer(issuesContainer, newItem),
  replaceIssue: (issueId, issueData) =>
    replaceItemInContainer(issuesContainer, issueId, issueId, issueData),
  removeIssue: (issueId, issueType) =>
    removeItemFromContainer(issuesContainer, issueId, issueId),
};
