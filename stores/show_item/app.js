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
//create a mysql pool 
var pool = mysql.createPool({
    
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
});


exports.lambdaHandler = async (event, context) => {
    
     let store_results = [];
    
    // ready to go for CORS. To make this a completed HTTP response, you only need to add a statusCode and a body.
    let response = {
        headers: {
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Origin": "*", // Allow from anywhere
            "Access-Control-Allow-Methods": "POST"
        }
    }; // response
    
    let actual_event = event.body;
    let info = JSON.parse(actual_event);
    console.log("info:" + JSON.stringify(info));
    
    let showItem = (sku) => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT name, descriptions, price FROM items where SKU = ?", [sku], (error, rows) => {
                if (error) { return reject(error); }
                if ((rows) && (rows.length == 1)) {
                    console.log(JSON.stringify(rows));
                    return resolve(rows[0]);   
                } else { 
                    return resolve("Unable to find SKU " + sku); 
                }
            });
        });
    }
    try {
        // const ret = await axios(url);
        const item = await showItem(info.sku);
        
        console.log(item);
        if (typeof item === 'string' || item instanceof String) {
            response.statusCode = 400;
            response.error = item;
        } else {
            response.statusCode = 200;
            response.result = item;
        }
        
    } catch (err) {
        response.statusCode = 400;
        console.log(err);
        return err;
    }

    return response
};
