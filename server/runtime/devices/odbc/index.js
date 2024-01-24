/**
 * 'odbc': odbc wrapper to communicate with Database 
 */

'use strict';
var odbc;
const utils = require('../../utils');
const deviceUtils = require('../device-utils');

function ODBCclient(_data, _logger, _events) {
    var data = JSON.parse(JSON.stringify(_data)); // Current Device data { id, name, tags, enabled, ... }
    var logger = _logger;
    var lastStatus = '';                    // Last connections status
    var varsValue = {};                     // Tags to send to frontend { id, type, value }
    var events = _events;                   // Events to commit change to runtime
    var connection = null;                  // ODBC connection
    var working = false;                    // Working flag to manage overloading polling and connection
    var overloading = 0;                    // Overloading counter to mange the break connection
    var getProperty = null;                 // Function to ask property (security)
    var currentTable = null;                // Current Tablename
    /**
     * initialize the device type 
     */
    this.init = function (_type) {
        console.error('Not supported!');
    }

    /**
     * Connect to device
     * Emit connection status to clients, clear all Tags values
     */
    this.connect = function () {
        return new Promise(async (resolve, reject) => {
            if (data.property && data.property.address) {
                try {
                    _clearVarsValue();
                    if (_checkWorking(true)) {
                        logger.info(`'${data.name}' try to connect ${data.property.address}`, true);
                        var security
                        await getProperty({query: 'security', name: data.id}).then((result, error) => {
                            if (result) {
                                security = utils.JsonTryToParse(result.value);
                            }
                        });
                        var connectionsString = data.property.address;
                        if (security.uid) {
                            connectionsString += `;UID=${security.uid}`;
                        }
                        if (security.pwd) {
                            connectionsString += `;PWD=${security.pwd}`;
                        }
                        const connectionConfig = {
                            connectionString: connectionsString,
                            connectionTimeout: 10,
                            loginTimeout: 10,
                        }
                        connection = await odbc.connect(connectionConfig)
                        var tables = await connection.tables(null, 'dbo', null, null);
                        if (tables.length <= 0) {
                            tables = await connection.tables(null, null, null, null);
                        }
                        currentTable = null;
                        const tablesToQuery = tables.find(table => table.TABLE_NAME === security.mode);
                        if (tablesToQuery) {
                            currentTable = security.mode;
                            logger.info(`'${data.name}' connected!`);
                            _emitStatus('connect-ok');
                            _checkWorking(false);
                            resolve();
                            return;
                        }
                        logger.error(`'${data.name}' missing '${data.mode}' connection data!`);
                        _emitStatus('connect-failed');
                    }
                } catch (err) {
                    logger.error(`'${data.name}' try to connect error! ${err}`);
                    _emitStatus('connect-error');
                }
                if (connection) {
                    try {
                        connection.close();
                    } catch { }
                }
                reject();
            } else {
                logger.error(`'${data.name}' missing connection data!`);
                _emitStatus('connect-failed');
                _clearVarsValue();
                reject();
            }
            _checkWorking(false);
        })
    }


    /**
     * Disconnect
     * Emit connection status to clients, clear all Tags values
     */
    this.disconnect = function () {
        return new Promise((resolve, reject) => {
            if (connection) {
                try {
                    connection.close();
                } catch { }
                _checkWorking(false);
                _emitStatus('connect-off');
                _clearVarsValue();
                resolve(true);
            }
        })
    }

    /**
     * Browse Table to read column
     */
    this.browse = function (node) {
        return new Promise( async function (resolve, reject) {
                if (_checkWorking(true)) {
                    try {
                        const columns = await connection.columns(null, null, currentTable, null);
                        const result = columns.map(column => { 
                            return { 
                                id: column.COLUMN_NAME,
                                name: column.COLUMN_NAME,
                                type: column.TYPE_NAME,
                                class: 'Variable'
                            }});
                        resolve(result);
                    } catch (err) {
                        if (err) {
                            logger.error(`'${data.name}' browse failure! ${err}`);
                        }
                        reject();
                    }
                    _checkWorking(false);
                }
        });
    }

    /**
     * Read values in polling mode 
     * Update the tags values list, save in DAQ if value changed or in interval and emit values to clients
     */
    this.polling = function () {
        if (_checkWorking(true)) {
            _checkWorking(false);
        }
    }

    /**
     * Load Tags attribute to read with polling
     */
    this.load = function (_data) {
        console.error('Not supported!');
    }

    /**
     * Return Tags values array { id: <name>, value: <value> }
     */
    this.getValues = function () {
        console.error('Not supported!');
    }

    /**
     * Return Tag value { id: <name>, value: <value>, ts: <lastTimestampValue> }
     */
    this.getValue = function (tagid) {
        console.error('Not supported!');
    }

    /**
     * Return connection status 'connect-off', 'connect-ok', 'connect-error', 'connect-busy'
     */
    this.getStatus = function () {
        return lastStatus;
    }

    /**
     * Return Tag property to show in frontend
     */
    this.getTagProperty = function (tagid) {
        console.error('Not supported!');
    }

    /**
     * Set the Tag value to device
     */
    this.setValue = function (tagid, value) {
        console.error('Not supported!');
    }

    /**
     * Return if device is connected
     */
    this.isConnected = function () {
        return (connection) ? connection.connected : false;
    }

    /**
     * Bind the DAQ store function and default daqInterval value in milliseconds
     */
    this.bindAddDaq = function (fnc) {
        this.addDaq = fnc;                         // Add the DAQ value to db history
    }

    /**
     * Return the timestamp of last read tag operation on polling
     * @returns 
     */
    this.lastReadTimestamp = () => {
        console.error('Not supported!');
    }

    /**
     * Set function to ask property (security)
     */
    this.bindGetProperty = function (fnc) {
        getProperty = fnc;
    }

    /**
     * Used to manage the async connection and polling automation (that not overloading)
     * @param {*} check 
     */
    var _checkWorking = function (check) {
        if (check && working) {
            overloading++;
            logger.warn(`'${data.name}' working (connection || polling) overload! ${overloading}`);
            // !The driver don't give the break connection
            if (overloading >= 3) {
                try {
                    if (connection) connection.close();
                } catch (e) {
                    console.error(e);
                }
            } else {
                return false;
            }
        }
        working = check;
        overloading = 0;
        return true;
    }

    /**
     * Clear local values by set all to null
     */
    var _clearVarsValue = function () {
        for (var id in varsValue) {
            varsValue[id].value = null;
        }
        // _emitValues(varsValue);
    }

    /**
     * Emit the odbc connection status
     * @param {*} status 
     */
    var _emitStatus = function (status) {
        lastStatus = status;
        events.emit('device-status:changed', { id: data.name, status: status });
    }    
}

/**
 * Return tables list
 */
function getTables(endpoint, fncGetProperty) {
    return new Promise( async function (resolve, reject) {
        if (loadOdbcLib()) { 
            var connection;
            try {
                var security
                await fncGetProperty({query: 'security', name: endpoint.id}).then((result, error) => {
                    if (result) {
                        security = utils.JsonTryToParse(result.value);
                    }
                });
                var connectionsString = endpoint.address;
                if (endpoint.uid || security.uid) {
                    connectionsString += `;UID=${endpoint.uid || security.uid}`;
                }
                if (endpoint.pwd || security.pwd) {
                    connectionsString += `;PWD=${endpoint.pwd || security.pwd}`;
                }
                const connectionConfig = {
                    connectionString: connectionsString,
                    connectionTimeout: 10,
                    loginTimeout: 10,
                }
                connection = await odbc.connect(connectionConfig)
                var tables = await connection.tables(null, 'dbo', null, null);
                if (tables.length <= 0) {
                    tables = await connection.tables(null, null, null, null);
                }
                const resultEndpoints = tables.map(table => table.TABLE_NAME);
                resolve(resultEndpoints);
            } catch (err) {
                reject('getendpoints-error: ' + err);
            }
            if (connection) {
                connection.close();
            }
        } else {
            reject('getendpoints-error: node-opcua not found!');
        }
    });
}

function loadOdbcLib() {
    if (!odbc) {
        try { odbc = require('odbc'); } catch { }
        if (!odbc && manager) { try { odbc = manager.require('odbc'); } catch { } }
    }
    return (odbc) ? true : false;
}

module.exports = {
    init: function (settings) {
        // deviceCloseTimeout = settings.deviceCloseTimeout || 15000;
    },
    create: function (data, logger, events, manager) {
        if (!loadOdbcLib()) return null;
        return new ODBCclient(data, logger, events);
    },
    getTables: getTables
}