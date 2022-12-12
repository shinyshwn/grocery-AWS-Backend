// CORPORATE

// const axios = require('axios')
// const url = 'http://checkip.amazonaws.com/';
let response;

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */

const mysql = require('mysql');

var config = require('./config.json');
var pool = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
});


exports.lambdaHandler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    
    let store_results = [];
    
    // ready to go for CORS. To make this a completed HTTP response, you only need to add a statusCode and a body.
    let response = {
        headers: {
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Origin": "*", // Allow from anywhere
            "Access-Control-Allow-Methods": "POST"
        }
    }; // response
    
    let selectStores = () => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT * FROM stores", (error, rows) => {
                if (error) { return reject(error); }
                if ((rows)) {
                    console.log(JSON.stringify(rows));
                    store_results = rows;
                    return resolve(true);   // TRUE if does exist
                } else { 
                    return resolve(true);   // REJECT if couldn't update WAIT TO CHECK
                }
            });
        });
    }
    
    
    try {
        await selectStores()
        
         response.result = store_results;
        
    } catch (err) {
        console.log(err);
        return err;
    }

    return response
};
