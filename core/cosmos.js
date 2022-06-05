import config from 'config';
import debug from 'debug';
import { CosmosClient, Database, Container } from '@azure/cosmos';

// create debug channels
const debugCosmos = debug('app:core:cosmos');

/**
 * Open a connection to our Cosmos database.
 * Also creates the database and/or container if needed.
 */
async function connect() {
  // get cosmos configuration
  const {
    endpoint,
    key,
    databaseId,
    containerId,
    partitionKey,
    offerThroughput,
  } = config.get('cosmos');

  // create a client
  const client = new CosmosClient({ endpoint, key });

  // Create the database, if it does not exist
  const { database } = await client.databases.createIfNotExists({
    id: databaseId,
  });
  debugCosmos(`Created database: ${database.id}`);

  // Create the container, if it does not exist
  const { container } = await client
    .database(databaseId)
    .containers.createIfNotExists(
      { id: containerId, partitionKey },
      { offerThroughput: parseInt(offerThroughput) }
    );
  debugCosmos(`Created container: ${container.id}`);

  return { client, database, container };
}

/**
 * Fetches all items from a container and returns them as an array.
 * @param {Container} container
 * @returns {Array<any>}
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
 * @returns {any}
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
 * Add a new item to a container.
 * @param {Container} container
 * @param {any} newItem
 * @returns {any}
 */
async function addItemToContainer(container, newItem) {
  const { resource: createdItem } = await container.items.create(newItem);
  return createdItem;
}

// open a connection
const { client, database, container } = await connect();

// export
export default {
  getAllIssues: () => getAllItemsFromContainer(container),
  getIssueById: (id) => getItemByIdFromContainer(container, id),
  addIssue: (newItem) => addItemToContainer(container, newItem),
};
