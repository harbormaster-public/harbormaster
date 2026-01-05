/**
 * Test helper to stub MongoDB collection methods for server-side testing
 *
 * Since Meteor collections don't have sync methods (findOne, fetch, count)
 * on the server, this helper creates an in-memory data store that works
 * with both sync and async methods.
 *
 * Usage:
 *   import { setupInMemoryCollection }
 *     from './test-helpers/setup-collection-stubs';
 *
 *   let lanesStub;
 *   beforeEach(async () => {
 *     await resetDatabase();
 *     lanesStub = setupInMemoryCollection(Lanes);
 *     lanesStub.insert({ _id: 'test', name: 'Test Lane' });
 *   });
 *
 *   afterEach(() => {
 *     lanesStub.restore(); // Cleans up memory and restores methods
 *   });
 */

/**
 * Sets up an in-memory data store for a collection with sync/async methods
 *
 * @param {Object} Collection - Meteor collection to stub
 * @returns {Object} Object with restore, insert, and clear methods
 */
import { applyServerTestStubs } from './namespace-stubs';

export const setupInMemoryCollection = (Collection) => {
  if (!H.isServer || !H.isTest) {
    return {
      restore: () => {},
      insert: () => {},
    };
  }

  applyServerTestStubs(H);

  const dataStore = [];
  const originalFindOne = Collection.findOne;
  const originalFindOneAsync = Collection.findOneAsync;
  const originalFind = Collection.find;
  const originalInsertAsync = Collection.insertAsync;
  const originalUpsertAsync = Collection.upsertAsync;

  /**
   * Matches an item against a query
   * @param {Object} item - Item to match
   * @param {Object|string} query - Query object or string (_id)
   * @returns {boolean} True if item matches query
   */
  const matchesQuery = (item, query) => {
    if (!query) return true;

    // Handle $or queries
    if (query.$or) {
      return query.$or.some((condition) => {
        // Handle nested operators in $or conditions by checking each key
        let hasDefinedKeys = false;
        for (const key in condition) {
          // Skip undefined values
          if (condition[key] === undefined) continue;
          hasDefinedKeys = true;

          // Handle $in operator
          if (condition[key].$in) {
            const fieldValue = item[key];
            const inArray = condition[key].$in;
            if (Array.isArray(fieldValue)) {
              if (!inArray.some((val) => fieldValue.includes(val))) {
                return false;
              }
            }
            else if (!inArray.includes(fieldValue)) {
              return false;
            }
          }
          // Handle $exists operator
          else if (condition[key].$exists !== undefined) {
            const fieldExists = key in item;
            if (condition[key].$exists === true && !fieldExists) {
              return false;
            }
            if (condition[key].$exists === false && fieldExists) {
              return false;
            }
          }
          // Simple equality check
          else if (item[key] !== condition[key]) {
            return false;
          }
        }
        // Only match if there were defined keys and they all matched
        return hasDefinedKeys;
      });
    }

    // Handle direct field queries
    for (const key in query) {
      if (query[key] === undefined) {
        continue;
      }
      // Special handling for _id queries - match both object and string
      if (key === '_id') {
        const itemId = String(item._id);
        const queryId = String(query._id);
        if (item._id !== query._id && itemId !== queryId) {
          return false;
        }
      }
      // Handle $in operator
      else if (query[key].$in) {
        const fieldValue = item[key];
        const inArray = query[key].$in;
        // If field is an array, check if any value in $in is in the array
        if (Array.isArray(fieldValue)) {
          if (!inArray.some((val) => fieldValue.includes(val))) {
            return false;
          }
        }
        // If field is a single value, check if it's in the $in array
        else if (!inArray.includes(fieldValue)) {
          return false;
        }
      }
      // Handle $ne (not equal) operator
      else if (query[key].$ne !== undefined) {
        if (item[key] === query[key].$ne) {
          return false;
        }
      }
      // Handle $not operator (e.g., { expired: { $not: { $exists: true } } })
      else if (query[key].$not) {
        const notQuery = query[key].$not;
        // Handle $not with $exists
        if (notQuery.$exists !== undefined) {
          const fieldExists = key in item;
          if (notQuery.$exists === true && fieldExists) {
            return false;
          }
          if (notQuery.$exists === false && !fieldExists) {
            return false;
          }
        }
        // Handle other $not conditions
        else if (matchesQuery(item, { [key]: notQuery })) {
          return false;
        }
      }
      else if (item[key] !== query[key]) {
        return false;
      }
    }
    return true;
  };

  /**
   * Finds all items matching the query
   * @param {Object|string} query - Query object or string (_id)
   * @returns {Array} Array of matching items
   */
  const findMatchingItems = (query) => {
    return dataStore.filter((item) => matchesQuery(item, query));
  };

  // Stub insertAsync to add to in-memory store
  Collection.insertAsync = async function (doc) {
    const item = Array.isArray(doc) ? doc : [doc];
    dataStore.push(...item);
    return doc._id || doc[0]?._id;
  };

  // Stub upsertAsync to insert or update in-memory store
  Collection.upsertAsync = async function (selector, modifier) {
    const query = typeof selector === 'string' ? { _id: selector } : selector;
    const selectorId = query._id || modifier._id;
    const existingIndex = dataStore.findIndex((item) =>
      matchesQuery(item, query)
    );
    if (existingIndex >= 0) {
      dataStore[existingIndex] = { ...dataStore[existingIndex], ...modifier };
      return { numberAffected: 1 };
    }
    const newDoc = { ...modifier };
    if (selectorId) {
      newDoc._id = selectorId;
    }
    dataStore.push(newDoc);
    return { numberAffected: 1, insertedId: newDoc._id };
  };

  // Stub findOne to query in-memory store (sync)
  Collection.findOne = function (query) {
    // Handle string queries (by _id)
    if (typeof query === 'string') {
      return dataStore.find((item) => item._id === query);
    }
    return dataStore.find((item) => matchesQuery(item, query));
  };

  // Stub findOneAsync to query in-memory store (async)
  Collection.findOneAsync = async function (query) {
    // Handle string queries (by _id)
    if (typeof query === 'string') {
      return dataStore.find((item) => item._id === query);
    }
    return dataStore.find((item) => matchesQuery(item, query));
  };

  /**
   * Applies cursor options (sort, limit, skip, fields) to results
   * @param {Array} items - Items to process
   * @param {Object} options - Cursor options
   * @returns {Array} Processed items
   */
  const applyCursorOptions = (items, options) => {
    if (!options) return items;

    let results = items;

    // Apply sorting
    if (options.sort) {
      const sortKeys = Object.keys(options.sort);
      results = [...items].sort((a, b) => {
        for (const key of sortKeys) {
          const order = options.sort[key];
          // Handle nested field paths (e.g., 'salvage_plan.name')
          const getNestedValue = (obj, path) => {
            return path.split('.').reduce((current, prop) => {
              return current && current[prop];
            }, obj);
          };
          const aValue = getNestedValue(a, key);
          const bValue = getNestedValue(b, key);
          if (aValue < bValue) return -1 * order;
          if (aValue > bValue) return 1 * order;
        }
        return 0;
      });
    }

    // Apply skip
    if (options.skip) {
      results = results.slice(options.skip);
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    // Apply field projection
    if (options.fields) {
      results = results.map((item) => {
        const filtered = {};
        for (const key in options.fields) {
          if (options.fields[key] === 1) {
            filtered[key] = item[key];
          }
        }
        return filtered;
      });
    }

    return results;
  };

  // Stub find() to return cursor with fetch() and count() methods
  Collection.find = function (query, options) {
    const cursor = originalFind.call(this, query, options);
    const matchingItems = findMatchingItems(query);
    const results = applyCursorOptions(matchingItems, options);

    // Sync methods
    cursor.fetch = function () {
      return results;
    };

    cursor.count = function () {
      return matchingItems.length;
    };

    // Async methods
    cursor.fetchAsync = async function () {
      return results;
    };

    cursor.countAsync = async function () {
      return matchingItems.length;
    };

    return cursor;
  };

  return {
    /**
     * Restores original collection methods and cleans up memory
     */
    restore: function () {
      // Restore original methods
      Collection.findOne = originalFindOne;
      if (originalFindOneAsync) {
        Collection.findOneAsync = originalFindOneAsync;
      }
      Collection.find = originalFind;
      Collection.insertAsync = originalInsertAsync;
      if (originalUpsertAsync) {
        Collection.upsertAsync = originalUpsertAsync;
      }

      // Clean up memory
      dataStore.length = 0;
      // Clear array reference to help GC
      if (dataStore.splice) {
        dataStore.splice(0, dataStore.length);
      }
    },

    /**
     * Inserts document(s) into the in-memory store
     * @param {Object|Array} doc - Document or array of documents
     * @returns {string} Document _id
     */
    insert: function (doc) {
      const items = Array.isArray(doc) ? doc : [doc];
      dataStore.push(...items);
      return doc._id || doc[0]?._id;
    },

    /**
     * Clears all data from the in-memory store
     */
    clear: function () {
      dataStore.length = 0;
      if (dataStore.splice) {
        dataStore.splice(0, dataStore.length);
      }
    },
  };
};

