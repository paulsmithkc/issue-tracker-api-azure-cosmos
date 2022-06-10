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
  const issuesContainer = await createContainer(
    database,
    'Issues',
    '/_partitionKey'
  );
  const projectsContainer = await createContainer(
    database,
    'Projects',
    '/projectId'
  );
  const usersContainer = await createContainer(database, 'Users', '/userId');

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
 * @param {string} partitionKey
 * @returns {Promise<Container>}
 */
async function createContainer(database, containerId, partitionKey) {
  const { container } = await database.containers.createIfNotExists({
    id: containerId,
    partitionKey: partitionKey,
  });
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
 * Fetches items from a container, for a specific project, and returns them as an array.
 * @param {Container} container
 * @param {string} projectId
 * @returns {Promise<any[]>}
 */
async function getAllItemsForProject(container, projectId) {
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.projectId = @projectId',
    parameters: [{ name: '@projectId', value: projectId }],
  };
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
  debugCosmos('reading item', container.id, id, partitionKey);
  const result = await container.item(id, partitionKey).read();
  // debugCosmos('read', result);
  return result.resource;
}

/**
 * Add a new item to a container.
 * @param {Container} container
 * @param {any} newItem
 * @returns {Promise<any>}
 */
async function addItemToContainer(container, newItem) {
  debugCosmos('creating item', container.id, newItem.id);
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
  debugCosmos('replacing item', container.id, id, partitionKey);
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
  debugCosmos('deleting item', container.id, id, partitionKey);
  const { resource } = await container.item(id, partitionKey).delete();
  return resource;
}

// open a connection
const { client, database, issuesContainer, projectsContainer, usersContainer } =
  await connect();

// export
export const Projects = {
  getAll: () => getAllItemsFromContainer(projectsContainer),
  getById: (projectId) =>
    readItemFromContainer(projectsContainer, projectId, projectId),
  add: (newItem) => addItemToContainer(projectsContainer, newItem),
  replace: (projectId, projectData) =>
    replaceItemInContainer(
      projectsContainer,
      projectId,
      projectId,
      projectData
    ),
  remove: (projectId) =>
    removeItemFromContainer(projectsContainer, projectId, projectId),
};
export const Issues = {
  getAll: () => getAllItemsFromContainer(issuesContainer),
  getAllIssuesForProject: (projectId) =>
    getAllItemsForProject(issuesContainer, projectId),
  getById: (projectId, issueId) =>
    readItemFromContainer(issuesContainer, issueId, projectId + ';' + issueId),
  add: (newItem) => {
    newItem._partitionKey = newItem.projectId + ';' + newItem.issueId;
    return addItemToContainer(issuesContainer, newItem);
  },
  replace: (projectId, issueId, issueData) =>
    replaceItemInContainer(
      issuesContainer,
      issueId,
      projectId + ';' + issueId,
      issueData
    ),
  remove: (projectId, issueId) =>
    removeItemFromContainer(
      issuesContainer,
      issueId,
      projectId + ';' + issueId
    ),
};
