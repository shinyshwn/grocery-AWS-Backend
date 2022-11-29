// aisle_shelf_item

// const axios= require('axios')
// const url= 'http://checkip.amazonaws.com/';
let response;
const mysql = require('mysql');

var config = require('./config.json');
var pool = mysql.createPool({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
});


function query(conx, sql, params) {
    return new Promise((resolve, reject) => {
        conx.query(sql, params, function(err, rows) {
            if (err) {
                // reject because there was an error
                reject(err);
            }
            else {
                // resolve because we have result(s) from the query. it may be an empty rowset or contain multiple values
                resolve(rows);
            }
        });
    });
}

/**
 * Process Shiptment will process arrays of three args, storeID, sku, quantity
 * 
 * 
 * For each array: 
 * 1) check current shelf quantity for the sku at the given store 
 * 2) get the max shelf quantity for the sku 
 * 3) fill the current shelf quantity for the sku at the store 
 * 4) put any overflow/remainder of item into the overstock of that store
 * 5) return success for that item 
 * 
 */


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
    
    let info = JSON.parse(event.body);

// get table of items by aisle and shelf and store

    
    // method to check if the store has any inventory
    let CheckExistence = (store_id) => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT * FROM inventory WHERE store_id=?", [store_id], (error, rows) => {
                if (error) { return reject(error); }
                if ((rows) && (rows.length >= 1)) {
                    console.log("Existence checked 1: "+ rows)
                    return resolve(true); // TRUE if does exist
                }
                else {
                    console.log("Existence checked 2: "+ rows)
                    return resolve(false); // FALSE if doesn't exist
                }
            });
        });
    }

    // method to get table of sku and quantities for items on the specified shelf/aisle in the store
    let GetItemList = (store_id, shelf, aisle) => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT sku, quantity FROM inventory WHERE store_id=? AND sku IN (SELECT sku FROM items WHERE shelf=? AND aisle=?);", [store_id, shelf, aisle], (error, rows) => {
                if (error) { return reject(error); }
                console.log("GOT ITEM LIST : "+ rows)
                console.log("GOT ITEM LIST :stringify "+ JSON.stringify(rows))
                if ((rows) && (rows.length >= 1)) {
                    console.log("getItem list check 1: "+ JSON.stringify(rows))
                    let data = JSON.stringify(rows); 
                    return resolve(data); // data stringified table of sku and quantity if was able to retrieve
                }
                else {
                    console.log("Get item list check 2: "+ JSON.stringify(rows))
                    return resolve(''); // REJECT if couldn't add  WAIT TO CHECK
                }
            });
        });
    }
        try {
            console.log("inputted json body: "+ info)
            let store_id = info.store_id; 
            let shelf = info.shelf; 
            let aisle = info.aisle; 
            console.log(" and getting items for store: "+store_id)
            
            const exists = await CheckExistence(store_id); 
            console.log("CHECKED existence is "+exists)
            
            if(exists) {
                
                const itemList = await GetItemList(store_id, shelf, aisle); 
                console.log("E3 - Item List is : "+itemList)
                
                if (itemList == '') {
                    console.log("No item list ")
                    response.statusCode = 400;
                    response.error = "Could not find items on given shelf/aisle at this store";
                }
            }
            else {
                response.error = "Store not found"; 
                response.statusCode = 400; 
            }
        }
        catch (error) {
            console.log("ERROR: " + error);
            response.statusCode = 400;
            response.error = error;
        }
    
    console.log("RESPONSE FINAL : "+response)
    
return response;
};