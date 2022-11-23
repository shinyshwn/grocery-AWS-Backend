// const axios = require('axios')
// const url = 'http://checkip.amazonaws.com/';

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
 
let response;
const mysql = require('mysql');

var config = require('./config.json');
var pool = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
});

// https://www.freecodecamp.org/news/javascript-promise-tutorial-how-to-resolve-or-reject-promises-in-js/#:~:text=Here%20is%20an%20example%20of,message%20Something%20is%20not%20right!%20.
function query(conx, sql, params) {
    return new Promise((resolve, reject) => {
        conx.query(sql, params, function(err, rows) {
            if (err) {
                // reject because there was an error
                reject(err);
            } else {
                // resolve because we have result(s) from the query. it may be an empty rowset or contain multiple values
                resolve(rows);
            }
        });
    });
}
    
exports.lambdaHandler = async (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;
    var store_results = [];
    
    // ready to go for CORS. To make this a completed HTTP response, you only need to add a statusCode and a body.
    let response = {
        headers: {
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Origin": "*", // Allow from anywhere
            "Access-Control-Allow-Methods": "POST" // Allow POST request
        }
    }; // response
    
    let actual_event = event.body;
    let info = JSON.parse(actual_event);
    console.log("info:" + JSON.stringify(info));

    let searchBySKU = (sku) => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT * FROM stores where id IN (SELECT store_id FROM inventory where sku IN (SELECT sku FROM items WHERE sku=?))", [sku], (error, rows) => {
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
    
    let searchByDescription = (desc) => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT * FROM stores where id IN (SELECT store_id FROM inventory where sku IN (SELECT sku FROM items WHERE descriptions LIKE ?))", ['%'+desc+'%'], (error, rows) => {
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
    
    let searchByName = (name) => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT * FROM stores where id IN (SELECT store_id FROM inventory where sku IN (SELECT sku FROM items WHERE name LIKE ?))", ['%'+name+'%'], (error, rows) => {
                if (error) { return reject(error); }
                if ((rows)) {
                    console.log('Name1');
                    console.log(JSON.stringify(rows));
                    console.log('Name2');
                    store_results = rows;
                    console.log('Name3');
                    return resolve(true);   // TRUE if does exist
                } else { 
                    return resolve(true);   // REJECT if couldn't update WAIT TO CHECK
                }
            });
        });
    }
    
    // let findDistance = (user_lat, user_lng, store_lat, store_lng) => {
        
    //     //npm install --save haversine-distance
    //     var haversine = require("haversine-distance");
    //     // var haversine = require("haversine-distance");

    //     //User location in haversine calculation
    //     var user_location = { lat: user_lat, lng: user_lng }
        
    //     //Store location in haversine calculation
    //     var store_location = { lat: store_lat, lng: store_lng }
        
    //     var distance = haversine(user_location, store_location); //Results in meters (default)
        
    //     return distance;
        
    // }
    let findDistance = (user_lat, user_lng, store_lat, store_lng) => {
        const haversine = require('haversine');
    
        const start = {
          latitude: user_lat,
          longitude: user_lng
        }
        
        const end = {
          latitude: store_lat,
          longitude: store_lng
        }
        
        return haversine(start, end);
    }
    
    
    try {
        
        console.log("E1")
        
       if ((info.sku)){
            console.log("E2")
            response.statusCode = 200;
            await searchBySKU(info.sku)
        } else if ((info.name)){
            console.log("E3")
            response.statusCode = 200;
            await searchByName(info.name);
        } else if ((info.description)){
            console.log("E4")
            response.statusCode = 200;
            await searchByDescription(info.description);
        } else {
            response.statusCode = 400;
            console.log("No sku, name, or description entered.");
        }
        
        var distances = [];
        console.log('xxxxxx');
        console.log(JSON.stringify(store_results));
        console.log(typeof store_results);
        
        store_results.forEach((store) =>{
            // JSON.parse(JSON.stringify(store));
            console.log(store.id);
            store.distance = findDistance(info.latitude, info.longitude, store.latitude, store.longitude);
            console.log(store.distance);
            
        });
    
        console.log(JSON.stringify(store_results));
        
        store_results.sort((a, b) => {
            return a.distance - b.distance;
        });
        
        console.log(JSON.stringify(store_results));
        
        response.result = store_results;
        
    
    } catch (error) {
        console.log("ERROR: " + error);
        response.statusCode = 400;
        response.error = error;
    }
    
        return response
};
