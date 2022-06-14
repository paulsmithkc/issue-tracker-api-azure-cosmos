import config from 'config';
import debug from 'debug';
import Cosmos, { CosmosClient, Database, Container } from '@azure/cosmos';

// create debug channels
const debugCosmos = debug('app:core:cosmos');
const debugError = debug('app:error');

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
  try {
    // get cosmos configuration
    const { endpoint, key, databaseId } = config.get('cosmos');
    const tlsRejectUnauthorized = config.get('tlsRejectUnauthorized');

    // log cosmos config
    debugCosmos('endpoint =', endpoint);
    debugCosmos('key =', key);
    debugCosmos('databaseId =', key);
    debugCosmos('tlsRejectUnauthorized =', tlsRejectUnauthorized);

    // create a client
    const client = new CosmosClient({ endpoint, key });

    // Create the database, if it does not exist
    const { database } = await client.databases.createIfNotExists({
      id: databaseId,
    });
    debugCosmos(`Created database: ${database.id}`);

    // Create the necessary containers
    const usersContainer = await createContainer(database, 'Users', '/userId');
    const projectsContainer = await createContainer(
      database,
      'Projects',
      '/projectId'
    );
    const issuesContainer = await createContainer(
      database,
      'Issues',
      '/_partitionKey'
    );

    return {
      client,
      database,
      issuesContainer,
      projectsContainer,
      usersContainer,
    };
  } catch (err) {
    debugError(err.message);
    throw new Error('Failed to connect to Cosmos DB: ' + err.message);
  }
}

/**
 * Creates a new container in our Cosmos database.
 * @param {Database} database
 * @param {string} containerId
 * @param {string} partitionKey
 * @param {Cosmos.UniqueKeyPolicy|undefined} uniqueKeyPolicy
 * @returns {Promise<Container>}
 */
async function createContainer(
  database,
  containerId,
  partitionKey,
  uniqueKeyPolicy
) {
  const { container } = await database.containers.createIfNotExists({
    id: containerId,
    partitionKey: partitionKey,
    uniqueKeyPolicy: uniqueKeyPolicy,
    throughput: 400,
  });
  debugCosmos(`Created container: ${container.id}`);
  return container;
}

/**
 * Queries a container items and return matching items as an array.
 * @param {Container} container
 * @param {Cosmos.SqlQuerySpec} querySpec
 * @returns {Promise<any[]>}
 */
async function queryItemsFromContainer(container, querySpec) {
  debugCosmos('querying container ', container.id);
  const query = container.items.query(querySpec);
  const { resources: items } = await query.fetchAll();
  return items;
}

/**
 * Fetches all items from a container and returns them as an array.
 * @param {Container} container
 * @returns {Promise<any[]>}
 */
async function getAllItemsFromContainer(container, orderBy = null) {
  debugCosmos('selecting all items', container.id);
  let sql = 'SELECT * FROM c';
  if (orderBy) {
    sql += ' ' + orderBy;
  }

  const querySpec = { query: sql };
  const query = container.items.query(querySpec);
  const { resources: items } = await query.fetchAll();
  return items;
}

/**
 * Fetches a specific item from a container.
 * @param {Container} container
 * @param {string} id
 * @returns {Promise<any>}
 */
async function getItemByIdFromContainer(container, id) {
  debugCosmos('selecting item by id', container.id, id);
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.id = @id',
    parameters: [{ name: '@id', value: id }],
  };
  const query = container.items.query(querySpec);
  const { resources: items } = await query.fetchAll();
  return items && items.length ? items[0] : null;
}

/**
 * Fetches a specific user by email address.
 * @param {Container} container
 * @param {string} email
 * @returns {Promise<any>}
 */
async function getUserByEmail(container, email) {
  debugCosmos('selecting user by email', container.id, email);
  const querySpec = {
    query: 'SELECT * FROM c WHERE c.email = @email',
    parameters: [{ name: '@email', value: email }],
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
export const Users = {
  getAll: () => getAllItemsFromContainer(usersContainer, 'ORDER BY c.email'),
  getById: (userId) => readItemFromContainer(usersContainer, userId, userId),
  getByEmail: (email) => getUserByEmail(usersContainer, email),
  add: (newItem) => addItemToContainer(usersContainer, newItem),
  replace: (userId, userData) =>
    replaceItemInContainer(usersContainer, userId, userId, userData),
  remove: (userId) => removeItemFromContainer(usersContainer, userId, userId),
};
export const Projects = {
  getAll: () => getAllItemsFromContainer(projectsContainer, 'ORDER BY c.title'),
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
  getAll: () =>
    queryItemsFromContainer(issuesContainer, {
      query: 'SELECT * FROM c WHERE c.type = @type ORDER BY c.createdOn DESC',
      parameters: [{ name: '@type', value: 'Issue' }],
    }),
  getAllIssuesForProject: (projectId) =>
    queryItemsFromContainer(issuesContainer, {
      query:
        'SELECT * FROM c ' +
        'WHERE c.projectId = @projectId AND c.type = @type ' +
        'ORDER BY c.createdOn DESC',
      parameters: [
        { name: '@projectId', value: projectId },
        { name: '@type', value: 'Issue' },
      ],
    }),
  getById: (projectId, issueId) =>
    readItemFromContainer(issuesContainer, issueId, projectId + ';' + issueId),
  add: (newItem) => {
    newItem._partitionKey = newItem.projectId + ';' + newItem.issueId;
    newItem.type = 'Issue';
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
export const IssueComments = {
  getAll: () =>
    queryItemsFromContainer(issuesContainer, {
      query: 'SELECT * FROM c WHERE c.type = @type ORDER BY c.createdOn ASC',
      parameters: [{ name: '@type', value: 'Comment' }],
    }),
  getAllCommentsForIssue: (projectId, issueId) =>
    queryItemsFromContainer(issuesContainer, {
      query:
        'SELECT * FROM c ' +
        'WHERE c.projectId = @projectId AND c.issueId = @issueId AND c.type = @type ' +
        'ORDER BY c.createdOn ASC',
      parameters: [
        { name: '@projectId', value: projectId },
        { name: '@issueId', value: issueId },
        { name: '@type', value: 'Comment' },
      ],
    }),
  add: (newItem) => {
    newItem._partitionKey = newItem.projectId + ';' + newItem.issueId;
    newItem.type = 'Comment';
    return addItemToContainer(issuesContainer, newItem);
  },
};
