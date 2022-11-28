// const axios = require('axios')
// const url = 'http://checkip.amazonaws.com/';
let response;
const mysql = require('mysql');
//const haversine = require('haversine');

var config = require('./config.json');
//create a mysql pool 
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


// Take in as input a payload.
//
// {  body: '{"longtitude" : "22.253772", “latitude” : “34.83784302”}}'
//
// }
//
// ===>  { "stores": [{"id" : "ZH7SG35E",   "longtitude" : "23.253772", “latitude” : “35.83784302”}, 
//                    {"id" : "HSAU738h",   "longtitude" : "63.253772", “latitude” : “65.83784302”}, 
//                     ....
//                                                                                                  ]}
//
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
    
    //get gps location from customer
    //grab location data from the database
    //calculate the distance, with store id
    //add the distance column to the table
    //return the stores ranked by distance


    let actual_event = event.body;
    let info = JSON.parse(actual_event);
    // console.log(info.longitude);
    // console.log(info.latitude);
    // console.log("info:" + JSON.stringify(info)); 

    // get raw value or, if a string, then get from database if exists.
    let ComputeArgumentValue = (info) => {
        if (!isNaN(info.longitude) && !isNaN(info.latitude)) {
            console.log(info.longitude)
            return new Promise((resolve, reject) => {
                pool.query("SELECT * FROM stores;" , (error, rows) => {
                    if (error) { return reject(error); }
                    if (rows) {
                        store_results = rows;
                        return resolve(true);
                    } else {
                        return reject("cannot get stores from database '");
                    }
                });
            });
        } else {
            // this is just the constant
            return new Promise((reject) => { return reject("longtitude and latitude can only be numbers"); });
        }
    }
    
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
        
        return haversine(start, end, {unit: 'mile'});
    }
    
    try {
        
        // 1. Query RDS for the first constant value
        // 2. Query RDS for the second constant value
        // ----> These have to be done asynchronously in series, and you wait for earlier 
        // ----> request to complete before beginning the next one
        let selectStoreResult = await ComputeArgumentValue(info);
        console.log(selectStoreResult);
        // 
        if (selectStoreResult == true) {
            //console.log(JSON.stringify(store_results));
            store_results.forEach((store) =>{
            // JSON.parse(JSON.stringify(store));
            //console.log(store.id);
            store.distance = findDistance(info.latitude, info.longitude, store.latitude, store.longitude);
            delete store['latitude'];
            delete store['longitude'];
            //console.log(store.distance);
            });
            
            
            store_results.sort((a, b) => {
                return a.distance - b.distance;
            });
        
            //console.log(JSON.stringify(store_results));
            
            response.statusCode = 200;
            response.result = store_results;

        } else {

            response.statusCode = 400;
           
            response.result = JSON.stringify(selectStoreResult);
        }
        
        
    } catch (error) {
        console.log("ERROR: " + error);
        response.statusCode = 400;
        response.error = error;
    }
    
    // full response is the final thing to send back
    return response;
}