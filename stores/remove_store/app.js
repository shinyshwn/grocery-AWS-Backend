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
 * Delete store will delete the store from stores as well as from inventory 
 * 
 * 'DELETE FROM inventory WHERE store_id=?', [store_id], (error, rows)
 * 
 * 1) check that store exists 
 * 2) delete store items from inventory table
 * 3) delete store from stores table
 * 
 * **) check that store has items??
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
    
    let actual_body = event.body;
    let info = JSON.parse(event.body);

    let CheckStoreExistence = (store_id) => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT * FROM stores WHERE id=?", [store_id], (error, rows) => {
                if (error) { return reject(error); }
                if ((rows) && (rows.length == 1)) {
                    console.log("Existence store checked 1: "+ rows)
                    return resolve(true); // TRUE if does exist
                }
                else {
                    console.log("Existence store checked 2: stringed "+ JSON.stringify(rows))
                    return resolve(false); // FALSE if doesn't exist
                }
            });
        });
    }
    
    let CheckInventoryExistence = (store_id) => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT * FROM inventory WHERE store_id=?", [store_id], (error, rows) => {
                if (error) { return reject(error); }
                if ((rows) && (rows.length >= 1)) {
                    console.log("Existence inventory checked 1: "+ rows)
                    return resolve(true); // TRUE if does exist
                }
                else {
                    console.log("Existence inventory checked 2: "+ rows)
                    return resolve(false); // FALSE if doesn't exist
                }
            });
        });
    }


    let DeleteStore = (store_id) => {
        return new Promise((resolve, reject) => {
            pool.query("DELETE FROM stores WHERE id=?", [store_id], (error, rows) => {
                if (error) { return reject(error); }
            // check delete store response 
                let deletedCount = JSON.parse(JSON.stringify(rows)).affectedRows; 
                console.log("row count is : "+deletedCount+" and is of type: "+deletedCount.typeof)
                if ((rows) &&  (deletedCount === 1)) {
                    console.log("Deletion 1: affected rows of ps"+ JSON.parse(JSON.stringify(rows)).affectedRows)
                    console.log("Deletion check 1: "+ JSON.stringify(rows))
                    return resolve(true); // TRUE if was able to add
                }
                else {
                    console.log("Deletion check 2: "+ JSON.stringify(rows))
                    return resolve(false); // REJECT if couldn't add  WAIT TO CHECK
                }
            });
        });
    }
    
    let DeleteItemsOfStore = (store_id) => {
        // console.log("deleting items from inventory for store: "+store_id)
        return new Promise((resolve, reject) => {
            pool.query("DELETE FROM inventory WHERE store_id=?", [store_id], (error, rows) => {
                if (error) { return reject(error); }
        // CHANGE UPDATE IF STATEMENT ?
                let deletedCount = JSON.parse(JSON.stringify(rows)).affectedRows; 
                console.log("Deletion items count: "+ JSON.parse(JSON.stringify(rows)).affectedRows)
                if ((rows) && (deletedCount >= 1)) {
                    console.log("successfully Deleted items check 1")
                    return resolve(true); // returns true if successful 
                }
                else {
                    console.log("failed to delete items check 2 : "+store_id)
                    return resolve(false); // returns false in case it is unsuccessful 
                }
            });
        });
    }

    // console.log("deleting for store whose info is: "+info)
    // console.log("and the actual json body is: "+actual_body)
    // console.log("actual body STORE ID : "+actual_body.store_id)
    let store_id = info.store_id; 
    // console.log("and store id is: "+ store_id)
    // console.log("and store id parsed is: "+ JSON.parse(store_id))

    try {

        console.log("E1");
        const storeExists = await CheckStoreExistence(store_id);

        console.log("E2");
        if (storeExists) {
            console.log("Enter store Exists")
            //check items exist for the store
            const inventoryExists = await CheckInventoryExistence(store_id);
            

            console.log("Enter inventory Exists")
            if (inventoryExists) {
                // get current tables stock values 
                const deletedItems = await DeleteItemsOfStore(store_id); 
                if(!deletedItems) {
                    response.error = "Count not delete items from store"; 
                }
            }
            
            const deletedStore = await DeleteStore(store_id); 
            console.log("E4")
            if(!deletedStore) {
                response.statusCode = 400; 
                response.error = "Could not delete the store"; 
            }
        }
        else {
            response.statusCode = 400; 
            response.error = "Could not find store"; 
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