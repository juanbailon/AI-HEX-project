require=(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
//const tf = require('@tensorflow/tfjs-node');

class Agent {
    constructor(name) {
        this.id = name;
        if (!name) {
            this.id = Math.round(Math.random() * 10e8);
        }
        this.state = null;
        this.perception = null;
        this.table = { "default": 0 };
    }

    /**
     * Setup of the agent. Could be override by the class extension
     * @param {*} parameters 
     */
    setup(initialState = {}) {
        this.initialState = initialState;
    }

    /**
     * Function that receive and store the perception of the world that is sent by the agent controller. This data is stored internally
     * in the this.perception variable
     * @param {Object} inputs 
     */
    receive(inputs) {
        this.perception = inputs;
    }

    /**
     * Inform to the Agent controller about the action to perform
     */
    send() {
        return this.table["deafult"];
    }

    /**
     * Return the agent id
     */
    getLocalName() {
        return this.id;
    }

    /**
      * Return the agent id
      */
    getID() {
        return this.id;
    }

    /**
     * Do whatever you do when the agent is stoped. Close connections to databases, write files etc.
     */
    stop() {}
}

module.exports = Agent;
},{}],2:[function(require,module,exports){

class AgentController {
    constructor() {
        this.agents = {};
        this.world0 = null;
        this.actions = [];
        this.data = { states: {}, world: {} };
    }
    /**
     * Setup the configuration for the agent controller
     * @param {Object} parameter 
     */
    setup(parameter) {
        this.problem = parameter.problem;
        this.world0 = JSON.parse(JSON.stringify(parameter.world));
        this.data.world = JSON.parse(JSON.stringify(parameter.world));
    }
    /**
     * Register the given agent in the controller pool. The second parameter stand for the initial state of the agent
     * @param {Agent} agent 
     * @param {Object} state0 
     */
    register(agent, state0) {
        if (this.agents[agent.getID()]) {
            throw 'AgentIDAlreadyExists';
        } else {
            this.agents[agent.getID()] = agent;
            this.data.states[agent.getID()] = state0;
            //TODO conver state0 to an inmutable object
            agent.setup(state0);
        }
    }
    /**
     * Remove the given agent from the controller pool
     * @param {Object} input 
     */
    unregister(input) {
        let id = "";
        if (typeof input == 'string') {
            id = input;
        } else if (typeof input == 'object') {
            id = input.getID();
        } else {
            throw 'InvalidAgentType';
        }
        let agent = this.agents[id];
        agent.stop();
        delete this.agents[id];
    }

    /**
    * This function start the virtual life. It will continously execute the actions
    * given by the agents in response to the perceptions. It stop when the solution function
    * is satisfied or when the max number of iterations is reached.
    * If it must to run in interactive mode, the start mode return this object, which is actually 
    * the controller
    * @param {Array} callbacks 
    */
    start(callbacks, interactive = false) {
        this.callbacks = callbacks;
        this.currentAgentIndex = 0;
        if (interactive === false) {
            this.loop();
            return null;
        } else {
            return this;
        }
    }

    /**
     * Executes the next iteration in the virtual life simulation
     */
    next() {
        if (!this.problem.goalTest(this.data)) {
            let keys = Object.keys(this.agents);
            let agent = this.agents[keys[this.currentAgentIndex]];
            agent.receive(this.problem.perceptionForAgent(this.getData(), agent.getID()));
            // Espera
            let action = agent.send();
            this.actions.push({ agentID: agent.getID(), action });
            this.problem.update(this.data, action, agent.getID());
            if (this.problem.goalTest(this.data)) {
                this.finishAll();
                return false;
            } else {
                if (this.callbacks.onTurn) {
                    this.callbacks.onTurn({ actions: this.getActions(), data: JSON.parse(JSON.stringify(this.data)) });
                }
                if (this.currentAgentIndex >= keys.length - 1) this.currentAgentIndex = 0;else this.currentAgentIndex++;
                return true;
            }
        }
    }

    /**
     * Virtual life loop. At the end of every step it executed the onTurn call back. It could b used for animations of login
     */
    loop() {
        let stop = false;
        while (!stop) {
            //Creates a thread for every single agent
            Object.values(this.agents).forEach(agent => {
                if (!this.problem.goalTest(this.data)) {
                    agent.receive(this.problem.perceptionForAgent(this.getData(), agent.getID()));
                    let action = agent.send();
                    this.actions.push({ agentID: agent.getID(), action });
                    this.problem.update(this.data, action, agent.getID());
                    if (this.problem.goalTest(this.data)) {
                        stop = true;
                    } else {
                        if (this.callbacks.onTurn) this.callbacks.onTurn({ actions: this.getActions(), data: this.data });
                    }
                }
            });
        }
        this.finishAll();
    }

    /**
     * This function is executed once the virtual life loop is ended. It must stop every single agent in the pool
     * and execute the onFinish callback 
     */
    finishAll() {
        // Stop all the agents
        Object.values(this.agents).forEach(agent => {
            //agent.stop();
            this.unregister(agent);
        });
        //Execute the callback
        if (this.callbacks.onFinish) this.callbacks.onFinish({ actions: this.getActions(), data: this.data });
    }

    /**
     * Return a copu of the agent controller data. The returned object contains the data of the problem (world) and the
     * state of every single agent in the controller pool (states)
     */
    getData() {
        return this.data;
    }
    /**
     * Return the history of the actions performed by the agents during the current virtual life loop
     */
    getActions() {
        return JSON.parse(JSON.stringify(this.actions));
    }

    /**
     * This function stop all the threads started by the agent controller and stops registered agents
     */
    stop() {
        this.finishAll();
    }
}

module.exports = AgentController;
},{}],3:[function(require,module,exports){
const AgentController = require('../core/AgentController');

/**
 * This class specifies the problem to be solved
 */
class Problem {
    constructor(initialState) {
        this.controller = new AgentController();
    }

    /**
     * Check if the given solution solves the problem. You must override
     * @param {Object} solution 
     */
    goalTest(solution) {}
    //TODO return boolean


    /**
     * The transition model. Tells how to change the state (data) based on the given actions. You must override
     * @param {} data 
     * @param {*} action 
     * @param {*} agentID 
     */
    update(data, action, agentID) {}
    //TODO modify data


    /**
     * Gives the world representation for the agent at the current stage
     * @param {*} agentID 
     * @returns and object with the information to be sent to the agent
     */
    perceptionForAgent(data, agentID) {}
    //TODO return the perception


    /**
     * Add a new agent to solve the problem
     * @param {*} agentID 
     * @param {*} agentClass 
     * @param {*} initialState 
     */
    addAgent(agentID, agentClass, initialState) {
        let agent = new agentClass(agentID);
        this.controller.register(agent, initialState);
    }

    /**
     * Solve the given problem
     * @param {*} world 
     * @param {*} callbacks 
     */
    solve(world, callbacks) {
        this.controller.setup({ world: world, problem: this });
        this.controller.start(callbacks, false);
    }

    /**
    * Returns an interable function that allow to execute the simulation step by step
    * @param {*} world 
    * @param {*} callbacks 
    */
    interactiveSolve(world, callbacks) {
        this.controller.setup({ world: world, problem: this });
        return this.controller.start(callbacks, true);
    }
}

module.exports = Problem;
},{"../core/AgentController":2}],4:[function(require,module,exports){
const Problem = require('./core/Problem');
const Agent = require('./core/Agent');
const AgentController = require('./core/AgentController');

module.exports = { Problem, Agent, AgentController };
},{"./core/Agent":1,"./core/AgentController":2,"./core/Problem":3}],5:[function(require,module,exports){
const Queue = require('./PriorityQueue');

const removeDeepFromMap = require('./removeDeepFromMap');

const toDeepMap = require('./toDeepMap');

const validateDeep = require('./validateDeep');
/** Creates and manages a graph */


class Graph {
  /**
   * Creates a new Graph, optionally initializing it a nodes graph representation.
   *
   * A graph representation is an object that has as keys the name of the point and as values
   * the points reacheable from that node, with the cost to get there:
   *
   *     {
   *       node (Number|String): {
   *         neighbor (Number|String): cost (Number),
   *         ...,
   *       },
   *     }
   *
   * In alternative to an object, you can pass a `Map` of `Map`. This will
   * allow you to specify numbers as keys.
   *
   * @param {Objec|Map} [graph] - Initial graph definition
   * @example
   *
   * const route = new Graph();
   *
   * // Pre-populated graph
   * const route = new Graph({
   *   A: { B: 1 },
   *   B: { A: 1, C: 2, D: 4 },
   * });
   *
   * // Passing a Map
   * const g = new Map()
   *
   * const a = new Map()
   * a.set('B', 1)
   *
   * const b = new Map()
   * b.set('A', 1)
   * b.set('C', 2)
   * b.set('D', 4)
   *
   * g.set('A', a)
   * g.set('B', b)
   *
   * const route = new Graph(g)
   */
  constructor(graph) {
    if (graph instanceof Map) {
      validateDeep(graph);
      this.graph = graph;
    } else if (graph) {
      this.graph = toDeepMap(graph);
    } else {
      this.graph = new Map();
    }
  }
  /**
   * Adds a node to the graph
   *
   * @param {string} name      - Name of the node
   * @param {Object|Map} neighbors - Neighbouring nodes and cost to reach them
   * @return {this}
   * @example
   *
   * const route = new Graph();
   *
   * route.addNode('A', { B: 1 });
   *
   * // It's possible to chain the calls
   * route
   *   .addNode('B', { A: 1 })
   *   .addNode('C', { A: 3 });
   *
   * // The neighbors can be expressed in a Map
   * const d = new Map()
   * d.set('A', 2)
   * d.set('B', 8)
   *
   * route.addNode('D', d)
   */


  addNode(name, neighbors) {
    let nodes;

    if (neighbors instanceof Map) {
      validateDeep(neighbors);
      nodes = neighbors;
    } else {
      nodes = toDeepMap(neighbors);
    }

    this.graph.set(name, nodes);
    return this;
  }
  /**
   * @deprecated since version 2.0, use `Graph#addNode` instead
   */


  addVertex(name, neighbors) {
    return this.addNode(name, neighbors);
  }
  /**
   * Removes a node and all of its references from the graph
   *
   * @param {string|number} key - Key of the node to remove from the graph
   * @return {this}
   * @example
   *
   * const route = new Graph({
   *   A: { B: 1, C: 5 },
   *   B: { A: 3 },
   *   C: { B: 2, A: 2 },
   * });
   *
   * route.removeNode('C');
   * // The graph now is:
   * // { A: { B: 1 }, B: { A: 3 } }
   */


  removeNode(key) {
    this.graph = removeDeepFromMap(this.graph, key);
    return this;
  }
  /**
   * Compute the shortest path between the specified nodes
   *
   * @param {string}  start     - Starting node
   * @param {string}  goal      - Node we want to reach
   * @param {object}  [options] - Options
   *
   * @param {boolean} [options.trim]    - Exclude the origin and destination nodes from the result
   * @param {boolean} [options.reverse] - Return the path in reversed order
   * @param {boolean} [options.cost]    - Also return the cost of the path when set to true
   *
   * @return {array|object} Computed path between the nodes.
   *
   *  When `option.cost` is set to true, the returned value will be an object with shape:
   *    - `path` *(Array)*: Computed path between the nodes
   *    - `cost` *(Number)*: Cost of the path
   *
   * @example
   *
   * const route = new Graph()
   *
   * route.addNode('A', { B: 1 })
   * route.addNode('B', { A: 1, C: 2, D: 4 })
   * route.addNode('C', { B: 2, D: 1 })
   * route.addNode('D', { C: 1, B: 4 })
   *
   * route.path('A', 'D') // => ['A', 'B', 'C', 'D']
   *
   * // trimmed
   * route.path('A', 'D', { trim: true }) // => [B', 'C']
   *
   * // reversed
   * route.path('A', 'D', { reverse: true }) // => ['D', 'C', 'B', 'A']
   *
   * // include the cost
   * route.path('A', 'D', { cost: true })
   * // => {
   * //       path: [ 'A', 'B', 'C', 'D' ],
   * //       cost: 4
   * //    }
   */


  path(start, goal, options = {}) {
    // Don't run when we don't have nodes set
    if (!this.graph.size) {
      if (options.cost) return {
        path: null,
        cost: 0
      };
      return null;
    }

    const explored = new Set();
    const frontier = new Queue();
    const previous = new Map();
    let path = [];
    let totalCost = 0;
    let avoid = [];
    if (options.avoid) avoid = [].concat(options.avoid);

    if (avoid.includes(start)) {
      throw new Error(`Starting node (${start}) cannot be avoided`);
    } else if (avoid.includes(goal)) {
      throw new Error(`Ending node (${goal}) cannot be avoided`);
    } // Add the starting point to the frontier, it will be the first node visited


    frontier.set(start, 0); // Run until we have visited every node in the frontier

    while (!frontier.isEmpty()) {
      // Get the node in the frontier with the lowest cost (`priority`)
      const node = frontier.next(); // When the node with the lowest cost in the frontier in our goal node,
      // we can compute the path and exit the loop

      if (node.key === goal) {
        // Set the total cost to the current value
        totalCost = node.priority;
        let nodeKey = node.key;

        while (previous.has(nodeKey)) {
          path.push(nodeKey);
          nodeKey = previous.get(nodeKey);
        }

        break;
      } // Add the current node to the explored set


      explored.add(node.key); // Loop all the neighboring nodes

      const neighbors = this.graph.get(node.key) || new Map();
      neighbors.forEach((nCost, nNode) => {
        // If we already explored the node, or the node is to be avoided, skip it
        if (explored.has(nNode) || avoid.includes(nNode)) return null; // If the neighboring node is not yet in the frontier, we add it with
        // the correct cost

        if (!frontier.has(nNode)) {
          previous.set(nNode, node.key);
          return frontier.set(nNode, node.priority + nCost);
        }

        const frontierPriority = frontier.get(nNode).priority;
        const nodeCost = node.priority + nCost; // Otherwise we only update the cost of this node in the frontier when
        // it's below what's currently set

        if (nodeCost < frontierPriority) {
          previous.set(nNode, node.key);
          return frontier.set(nNode, nodeCost);
        }

        return null;
      });
    } // Return null when no path can be found


    if (!path.length) {
      if (options.cost) return {
        path: null,
        cost: 0
      };
      return null;
    } // From now on, keep in mind that `path` is populated in reverse order,
    // from destination to origin
    // Remove the first value (the goal node) if we want a trimmed result


    if (options.trim) {
      path.shift();
    } else {
      // Add the origin waypoint at the end of the array
      path = path.concat([start]);
    } // Reverse the path if we don't want it reversed, so the result will be
    // from `start` to `goal`


    if (!options.reverse) {
      path = path.reverse();
    } // Return an object if we also want the cost


    if (options.cost) {
      return {
        path,
        cost: totalCost
      };
    }

    return path;
  }
  /**
   * @deprecated since version 2.0, use `Graph#path` instead
   */


  shortestPath(...args) {
    return this.path(...args);
  }

}

module.exports = Graph;

},{"./PriorityQueue":6,"./removeDeepFromMap":7,"./toDeepMap":8,"./validateDeep":9}],6:[function(require,module,exports){
/**
 * This very basic implementation of a priority queue is used to select the
 * next node of the graph to walk to.
 *
 * The queue is always sorted to have the least expensive node on top.
 * Some helper methods are also implemented.
 *
 * You should **never** modify the queue directly, but only using the methods
 * provided by the class.
 */
class PriorityQueue {
  /**
   * Creates a new empty priority queue
   */
  constructor() {
    // The `keys` set is used to greatly improve the speed at which we can
    // check the presence of a value in the queue
    this.keys = new Set();
    this.queue = [];
  }
  /**
   * Sort the queue to have the least expensive node to visit on top
   *
   * @private
   */


  sort() {
    this.queue.sort((a, b) => a.priority - b.priority);
  }
  /**
   * Sets a priority for a key in the queue.
   * Inserts it in the queue if it does not already exists.
   *
   * @param {any}     key       Key to update or insert
   * @param {number}  value     Priority of the key
   * @return {number} Size of the queue
   */


  set(key, value) {
    const priority = Number(value);
    if (isNaN(priority)) throw new TypeError('"priority" must be a number');

    if (!this.keys.has(key)) {
      // Insert a new entry if the key is not already in the queue
      this.keys.add(key);
      this.queue.push({
        key,
        priority
      });
    } else {
      // Update the priority of an existing key
      this.queue.map(element => {
        if (element.key === key) {
          Object.assign(element, {
            priority
          });
        }

        return element;
      });
    }

    this.sort();
    return this.queue.length;
  }
  /**
   * The next method is used to dequeue a key:
   * It removes the first element from the queue and returns it
   *
   * @return {object} First priority queue entry
   */


  next() {
    const element = this.queue.shift(); // Remove the key from the `_keys` set

    this.keys.delete(element.key);
    return element;
  }
  /**
   * @return {boolean} `true` when the queue is empty
   */


  isEmpty() {
    return Boolean(this.queue.length === 0);
  }
  /**
   * Check if the queue has a key in it
   *
   * @param {any} key   Key to lookup
   * @return {boolean}
   */


  has(key) {
    return this.keys.has(key);
  }
  /**
   * Get the element in the queue with the specified key
   *
   * @param {any} key   Key to lookup
   * @return {object}
   */


  get(key) {
    return this.queue.find(element => element.key === key);
  }

}

module.exports = PriorityQueue;

},{}],7:[function(require,module,exports){
/**
 * Removes a key and all of its references from a map.
 * This function has no side-effects as it returns
 * a brand new map.
 *
 * @param {Map}     map - Map to remove the key from
 * @param {string}  key - Key to remove from the map
 * @return {Map}    New map without the passed key
 */
function removeDeepFromMap(map, key) {
  const newMap = new Map();

  for (const [aKey, val] of map) {
    if (aKey !== key && val instanceof Map) {
      newMap.set(aKey, removeDeepFromMap(val, key));
    } else if (aKey !== key) {
      newMap.set(aKey, val);
    }
  }

  return newMap;
}

module.exports = removeDeepFromMap;

},{}],8:[function(require,module,exports){
/**
 * Validates a cost for a node
 *
 * @private
 * @param {number} val - Cost to validate
 * @return {bool}
 */
function isValidNode(val) {
  const cost = Number(val);

  if (isNaN(cost) || cost <= 0) {
    return false;
  }

  return true;
}
/**
 * Creates a deep `Map` from the passed object.
 *
 * @param  {Object} source - Object to populate the map with
 * @return {Map} New map with the passed object data
 */


function toDeepMap(source) {
  const map = new Map();
  const keys = Object.keys(source);
  keys.forEach(key => {
    const val = source[key];

    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      return map.set(key, toDeepMap(val));
    }

    if (!isValidNode(val)) {
      throw new Error(`Could not add node at key "${key}", make sure it's a valid node`, val);
    }

    return map.set(key, Number(val));
  });
  return map;
}

module.exports = toDeepMap;

},{}],9:[function(require,module,exports){
/**
 * Validate a map to ensure all it's values are either a number or a map
 *
 * @param {Map} map - Map to valiadte
 */
function validateDeep(map) {
  if (!(map instanceof Map)) {
    throw new Error(`Invalid graph: Expected Map instead found ${typeof map}`);
  }

  map.forEach((value, key) => {
    if (typeof value === 'object' && value instanceof Map) {
      validateDeep(value);
      return;
    }

    if (typeof value !== 'number' || value <= 0) {
      throw new Error(`Values must be numbers greater than 0. Found value ${value} at ${key}`);
    }
  });
}

module.exports = validateDeep;

},{}],"/src/HexAgent.js":[function(require,module,exports){
/* 
    INTEGRANTES

  JUAN JOSE BAILON 2028696
  MARLON ANDRES ANACONA 2023777

*/


const Agent = require('ai-agents').Agent;
// const transposeHex = require('./transposeHex');
// const boardS = require('./boardScore');
const Graph = require('node-dijkstra');

class HexAgent extends Agent {
  constructor(value) {
    super(value);
    
    // here i didnt see cache being use, but i dont deleted because
    // i dont know if it is being use somewhere else
    this.cache = {}; 
  }

  /**
   * return a new move. The move is an array of two integers, representing the
   * row and column number of the hex to play. If the given movement is not valid,
   * the Hex controller will perform a random valid movement for the player
   * Example: [1, 1]
   */
  send() {
    let id = this.getID()
    let board = this.perception;
    let size = board.length;
    let available = getEmptyHex(board);
    let nTurn = size * size - available.length;

    return moveGame(board, size, available, nTurn)

  }

}

module.exports = HexAgent;

/**
 * Return an array containing the id of the empty hex in the board
 * id = row * size + col;
 * @param {Matrix} board
 */
function getEmptyHex(board) {
  let result = [];
  let size = board.length;
  for (let k = 0; k < size; k++) {
    for (let j = 0; j < size; j++) {
      if (board[k][j] === 0) {
        result.push(k * size + j);
      }
    }
  }
  return result;
}



/************ HEURISTIC *********************/

/**
 * this function retunrns an estimate of how many steps you have to take to
 * go from one hex cell to another hex cell, usually this etimation is lower when
 * compare with the real distance
 * @param {Number} x1
 * @param {Number} y1
 * @param {Number} x2
 * @param {Number} y2
 * @returns {Number}
 */

function hex_distance(x1, y1, x2, y2) {
   const x_distance = Math.abs(x1 - x2);
   const y_distance = Math.abs(y1 - y2);

   const diagonal_steps = Math.min(x_distance, y_distance);

   const remaining_x_distance = x_distance - diagonal_steps;
   const remaining_y_distance = y_distance - diagonal_steps;

   if (remaining_x_distance > 0) {
     return (remaining_x_distance / 2) + diagonal_steps;
   } else {
     return remaining_y_distance + diagonal_steps;
   }
}


/**
*
* Tiene en cuenta la distancia más corta entre los movimientos del jugador y las conexiones ganadoras en el
* tablero dado, para determinar un valor de utilidad al tablero dado.
* Entre menor sea la distancia la función o heuristica devuelve una mayor valor de utilidad.
* Utiliza el algoritmo de distancia Manhattan para calcular la distancia.
* Tiene en cuenta una penalizacion para el puntaje que tiene que ver con cuantas conexiones tiene el jugador oponente
* tambien, entre mas conexiones tenga menor va a ser el puntaje del jugador.
* @param {Array} board - El estado actual del tablero de juego.
* @param {string} player - El jugador actual.
* @returns {number} - El valor de utilidad basado en la distancia más corta.
*/

function getShortestDistance(board, player) {
  const size = board.length;
  const path = boardPath(board);

  let score = 0;

  // if there is not any winnig path, then we assing a really small value
  if (!path) {
    score= Number.MIN_SAFE_INTEGER;
  }
  else{
    let shortest_distance = Infinity;

    // now we go through all the cells of the board
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {

        // here we check that the cell is empty or that it belongs to us
        // otherwise we skip the rest of the code, so that we get to the next iteration of the loop
        if(board[row][col] != 0 && board[row][col] != player)
          continue;


        const sideX = board[row][col] === player;
        const sideT = board[row][col] === player;

        //here we checkc if both ends of the board are connected, so this
        // means that the player has won, for that reson we return a high utility score
        if (sideT && sideX) {
          score = Number.MAX_SAFE_INTEGER;
        }
        else {

          //since the we dont have a fully connected wining path, we are going to
          //try to ger the best wining path for our current codition

          let distanceToWinningConnection = Infinity;

          for (connection of path) {
            const distance = hex_distance(col, row, connection[1], connection[0])

            if (distance < distanceToWinningConnection)
              distanceToWinningConnection = distance;
          }

          // if a new shortest distance is found, then we update the value of shortest_distance varible
          if (distanceToWinningConnection < shortest_distance) {
            shortest_distance = distanceToWinningConnection;
            score += 1;
          }
        }

      }
    }

    if (score != Number.MAX_SAFE_INTEGER){
      let rival = (player=='1')? '2' : '1'
      let rival_score = getShortestDistance(board, rival)
      score = score - rival_score
    }

  }


  return score;
}


/************ END HEURISTIC *********************/


class Arbol {

  constructor(id, padre = null, hijos = [], tablero) {
    this.id = id
    this.padre = padre
    this.hijos = hijos
    this.tablero = tablero
  }

  addChild(id, tablero) {
    const newChild = new Arbol(id)
    newChild.padre = this
    newChild.tablero = tablero
    this.hijos.push(newChild)
  }

}



function moveGame(board, size, available, nTurn) {
  if (nTurn == 0) {
    return [Math.floor(size / 2)+1, Math.floor(size / 2)];
  } else if (nTurn == 1) {
    return [Math.floor(size / 3), Math.floor(size / 3)];
  }

  let profundidad = 10;
  const arbol = new Arbol("root")

  if (nTurn % 2 == 0) {
    arbol.tablero = board
    crearArbol(arbol, 1, profundidad)
    let movimiento = minmax(arbol, profundidad, true, '1')
    return [Math.floor(movimiento / board.length), movimiento % board.length];
  }
  else {
    arbol.tablero = transposeHex(board)
    crearArbol(arbol, 2, profundidad)
    let movimiento = minmax(arbol, profundidad, true, '2')
    return [movimiento % board.length, Math.floor(movimiento / board.length)];
  }

}


function crearArbol(arbol, jugador, profundidad) {
  let tableroHijo = JSON.parse(JSON.stringify(arbol.tablero));
  let moValidos = boardPath(arbol.tablero);
  if (profundidad == 0) {
    for (let i = 1; i < moValidos.length - 1; i++) {
      let row = Math.floor(moValidos[i] / arbol.tablero.length)
      let col = moValidos[i] % arbol.tablero.length
      tableroHijo[row][col] = '1'
      arbol.addChild(moValidos[i], tableroHijo)
      tableroHijo = JSON.parse(JSON.stringify(arbol.tablero))
    }
  } else {
    if (moValidos.length > 2) {
      if (moValidos.length == 3) {
        let row = Math.floor(moValidos[1] / arbol.tablero.length)
        let col = moValidos[1] % arbol.tablero.length
        tableroHijo[row][col] = '1'
        arbol.addChild(moValidos[1], tableroHijo)
      } else {

        crearHijos(moValidos, tableroHijo, arbol)

        for (let i = 0; i < arbol.hijos.length; i++) {
          const element = arbol.hijos[i];
          crearArbol(element, jugador, profundidad - 1)
        }
      }
    }
  }
}

function crearHijos(hijos, tableroHijo, padre) {
  hijos.shift()
  hijos.pop()

  while (hijos.length != 0) {
    let row = Math.floor(hijos[0] / tableroHijo.length)
    let col = hijos[0] % tableroHijo.length
    tableroHijo[row][col] = '1'

    padre.addChild(hijos[0], tableroHijo)
    tableroHijo = JSON.parse(JSON.stringify(padre.tablero))
    hijos.shift()
  }
}



function minmax(arbol, profundidad, maxplayer, player, alfa = Number.MIN_SAFE_INTEGER, beta = Number.MAX_SAFE_INTEGER) {

  if (profundidad == 0 || arbol.hijos.length == 0) {
    // here we get he score/utility for the player in the current board
    return getShortestDistance(arbol.tablero, player)
  }

  var bestHeur, valminmax

  if (maxplayer) {
    bestHeur = Number.NEGATIVE_INFINITY;
    let movimiento = arbol.id

    for (const hijo in arbol.hijos) {
      valminmax = minmax(arbol.hijos[hijo], profundidad - 1, false, player)

      if (valminmax >= bestHeur) {
        movimiento = arbol.hijos[hijo].id
      }
      if (valminmax > alfa) {
        alfa = valminmax;
      }
      if (beta <= alfa) {
        break;
      }
      bestHeur = Math.max(valminmax, bestHeur)

    }

    return movimiento
  }
  else {
    bestHeur = Number.POSITIVE_INFINITY;
    let movimiento = arbol.id

    for (const hijo in arbol.hijos) {
      valminmax = minmax(arbol.hijos[hijo], profundidad - 1, true, player)
      if (valminmax >= bestHeur) {
        movimiento = arbol.hijos[hijo].id
      }
      if (beta > valminmax) {
        beta = valminmax;
      }
      if (beta <= alfa) {
        break;
      }
      bestHeur = Math.max(valminmax, bestHeur)
    }

    return movimiento
  }
}




function boardPath(board) {
    let player = '1';
    let size = board.length;

    const route = new Graph();

    let neighborsT = {};
    let neighborsX = {};


    // Build the graph out of the hex board
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        let key = i * size + j;
        if (board[i][j] === 0 || board[i][j] === player) {
          let list = getNeighborhood(key, player, board);

          list = removeIfAny(board, list, i, j);

          let neighbors = {};
          let sideX = false;
          let sideT = false;
          list.forEach(x => {
            switch (x) {
              case -1:
                neighbors[player + 'X'] = 1;
                neighborsX[key + ''] = 1;
                sideX = sideX || board[i][j] === player;
                break;
              case -2:
                neighbors[player + 'T'] = 1;
                neighborsT[key + ''] = 1;
                sideT = sideT || board[i][j] === player;
                break;
              default:
                neighbors[x + ''] = 1;
            }
          });
          // This case occurs when the game has finished
          if (sideT && sideX) {
            neighborsX[player + 'T'] = 1;
            neighborsT[player + 'X'] = 1;
          }
          route.addNode(key + '', neighbors);
        }
      }
    }

    route.addNode(player + 'T', neighborsT);
    route.addNode(player + 'X', neighborsX);

    return route.path(player + 'T', player + 'X');
  }

  
  /**
   * Evita que se consideren las casillas donde el enemigo tiene 2 opciones para cerrar el camino
   * @param {*} board
   * @param {*} list
   * @param {*} row
   * @param {*} col
   * @returns
   */
  function removeIfAny(board, list, row, col) {
    let size = board.length;
    if (row > 0 && col > 0 && row < size - 1 && col < size - 1 && list.length > 0) {
      if (board[row - 1][col] === 0 && board[row - 1][col - 1] === '2' && board[row][col + 1] === '2') {
        let k = list.findIndex(key => key === (row - 1) * size + col);

        if (k >= 0)
          list.splice(k, 1);
      }
      if (board[row][col + 1] === 0 && board[row - 1][col] === '2' && board[row + 1][col + 1] === '2') {
        let k = list.findIndex(key => key === row * size + col + 1);

        if (k >= 0)
          list.splice(k, 1);
      }
      if (board[row + 1][col + 1] === 0 && board[row][col + 1] === '2' && board[row + 1][col] === '2') {
        let k = list.findIndex(key => key === (row + 1) * size + col + 1);

        if (k >= 0)
          list.splice(k, 1);
      }
      if (board[row + 1][col] === 0 && board[row + 1][col + 1] === '2' && board[row + 1][col - 1] === '2') {
        let k = list.findIndex(key => key === (row + 1) * size + col);

        if (k >= 0)
          list.splice(k, 1);
      }
      if (board[row][col - 1] === 0 && board[row + 1][col] === '2' && board[row - 1][col - 1] === '2') {
        let k = list.findIndex(key => key === row * size + col - 1);

        if (k >= 0)
          list.splice(k, 1);
      }
      if (board[row - 1][col - 1] === 0 && board[row - 1][col] === '2' && board[row][col - 1] === '2') {
        let k = list.findIndex(key => key === (row - 1) * size + col - 1);

        if (k >= 0)
          list.splice(k, 1);
      }
    }
    return list;
  }


  /**
   * Return an array of the neighbors of the currentHex that belongs to the same player. The
   * array contains the id of the hex. id = row * size + col
   * @param {Number} currentHex
   * @param {Number} player
   * @param {Matrix} board
   */
  function getNeighborhood(currentHex, player, board) {
    let size = board.length;
    let row = Math.floor(currentHex / size);
    let col = currentHex % size;
    let result = [];
    let currentValue = board[row][col];

    board[row][col] = 'x';
    //Check if this value has been precalculated in this turn

    // Check the six neighbours of the current hex
    pushIfAny(result, board, player, row - 1, col);
    pushIfAny(result, board, player, row - 1, col + 1);
    pushIfAny(result, board, player, row, col + 1);
    pushIfAny(result, board, player, row, col - 1);
    pushIfAny(result, board, player, row + 1, col);
    pushIfAny(result, board, player, row + 1, col - 1);

    // Add the edges if hex is at the border
    if (col === size - 1) {
      result.push(-1);
    } else if (col === 0) {
      result.push(-2);
    }

    board[row][col] = currentValue;

    return result;
  }


  function pushIfAny(result, board, player, row, col) {
    let size = board.length;
    if(row<0 || row>=size) return;
    if(col<0 || col>=size) return;
    
    if(board[row][col] == player){
        result.push(...getNeighborhood(col + row * size, player, board));
    }
    else if(board[row][col] == 0){
        result.push(col + row * size);
    }
    
}



/**
 * Transpose and convert the board game to a player 1 logic
 * @param {Array} board 
 */
function transposeHex(board) {
  let size = board.length;
  let boardT = new Array(size);
  for (let j = 0; j < size; j++) {
      boardT[j] = new Array(size);
      for (let i = 0; i < size; i++) {
          boardT[j][i] = board[i][j];
          if (boardT[j][i] === '1') {
              boardT[j][i] = '2';
          } else if (boardT[j][i] === '2') {
              boardT[j][i] = '1';
          }
      }
  }
  return boardT;
}

},{"ai-agents":4,"node-dijkstra":5}]},{},[]);
