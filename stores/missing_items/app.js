// const axios = require('axios')
// const url = 'http://checkip.amazonaws.com/';
let response;
const mysql = require('mysql');

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


// Take in input as payload.
//
// {
//   "store_id": "31"
// }
//
// ===>  { missing items }
//
//

// get all in items table that are not in iventory where store_id=store_id




exports.lambdaHandler = async (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;

   // ready to go for CORS. To make this a completed HTTP response, you only need to add a statusCode and a body.
    let response = {
        headers: {
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Origin": "*", // Allow from anywhere
            "Access-Control-Allow-Methods": "POST" // Allow POST request
        }
    }; // response

    var missing_items_result = [];
    // var item_prices = [];
    // var store_total_value = 0; 
    
    let actual_event = event.body;
    let info = JSON.parse(actual_event);
    console.log("info:" + JSON.stringify(info)); //  info.arg1 and info.arg2

    // get raw value or, if a string, then get from database if exists.
    let getMissingItems = (store_id) => {
        if (store_id != "" && store_id != null) {
            console.log("STore Id in get Missing items: "+store_id)
            return new Promise((resolve, reject) => {
                pool.query("SELECT sku, name, price, max_quantity_per_shelf FROM items WHERE sku NOT IN (SELECT sku FROM inventory WHERE store_id=?);" , [store_id], (error, rows) => {
                    if (error) {
                        console.log("error"); 
                        // return reject(error); 
                        return reject(error)
                    }
                    if(rows){
                        if(rows.length < 1){
                            return reject(" No missing items for the store ")
                        }
                        missing_items_result = JSON.stringify(rows); 
                        console.log(missing_items_result);
                        console.log(rows.length);
                        return resolve(missing_items_result);
                    }
                    else{
                        return reject("Unable to get missing items for store " + store_id);
                    }
                })
            });
        }
        else {
             return new Promise((reject) => { return reject("Invalid Store ID"); });
        }
    }
    
    let clearMissingItems = () => {
        return new Promise((resolve, reject) => {
            pool.query("DELETE FROM inventory WHERE quantity=0 AND overstock=0;" , (error, rows) => {
                if (error) {
                    console.log("Error clearing missing items from table"); 
                    // return reject(error); 
                    return reject(error)
                }
                let deletedCount = JSON.parse(JSON.stringify(rows)).affectedRows; 
                console.log("row count is : "+deletedCount+" and is of type: "+deletedCount.typeof)
                if ((rows) &&  (deletedCount >= 1)) {
                    return resolve(true); // TRUE if was able to add
                }
                else {
                    // console.log("Deletion check 2: "+ JSON.stringify(rows))
                    return resolve(false); // REJECT if couldn't add  WAIT TO CHECK
                }
            });
        });
    }
    

    try {
        
        let store_id = info.store_id; 
        console.log("Store id from json: "+ store_id)
        
        const cleared = await clearMissingItems();
        
        const missingItems = await getMissingItems(store_id);
        
        // console.log("printing missing items: "+missingItems)
        
        if(missingItems !== [] ){
            response.statusCode = 200;
            response.result = missing_items_result;
        } 
        else {
            console.log("error " );
            response.statusCode = 400;
            response.error = JSON.stringify(' missing items error ');
        }
    } catch (error) {
        console.log("ERROR: " + error);
        response.statusCode = 400;
        response.error = error;
    }
    
    // full response is the final thing to send back
    console.log("FINALIZED response: "+ response.result)
    return response;
}

