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
 * Fill Shelves - 
 * 
 * 0. Check store inventory exists 
 * for all items in inventory: (1. get all skus in inventory for store_id)
 *      2. get max shelf for sku 
 *      3. calculate new shelf quantity and overstock 
 *      4. update inventory 
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
    
    // method to check if the store has that sku in inventory
    let CheckExistence = (store_id) => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT * FROM inventory WHERE store_id=?", [store_id], (error, rows) => {
                if (error) { return reject(error); }
                if ((rows) && (rows.length >= 1)) {
                    console.log("0 - Existence checked 1: "+ rows)
                    return resolve(true); // TRUE if does exist
                }
                else {
                    console.log("0 - Existence checked 2: "+ rows)
                    return resolve(false); // FALSE if doesn't exist
                }
            });
        });
    }
    
    // method to get the list of items in the store 
    let GetStoreItems = (store_id) => {
        console.log("1 - GetStoreItems current inventory store_id: "+store_id)
        return new Promise((resolve, reject) => {
            pool.query("SELECT sku, quantity, overstock FROM inventory WHERE store_id=?", [store_id], (error, data) => {
                if (error) { return reject(error); }
                if ((data) && (data.length >= 1)) {
                    console.log("1 - GetStoreItems rows data : "+data+" and "+data.length)
                    return resolve(data); // returns array of the current inventory values
                }
                else {
                    console.log("1 - GetSToreItems check 2 : " + data + " of type " + data.typeof)
                    return resolve(-1); // 0 if doesn't exist 
                }
            });
        });
    }

    // method to get the item max shelf quantity 
    let GetMaxShelfQuantity = (sku) => {
        // console.log("2 - GetMaxShelfQuantity input sku: "+sku)
        return new Promise((resolve, reject) => {
            pool.query("SELECT max_quantity_per_shelf FROM items WHERE sku=?", [sku], (error, data) => {
                if (error) { return reject(error); }
                if ((data) && (data.length == 1)) {
                    let sdata = JSON.stringify(data); 
                    let psdata = JSON.parse(sdata.slice(1, -1)); 
                    let max = psdata.max_quantity_per_shelf;
                    return resolve(max); // returns max shelf quantity if does exist
                }
                else {
                    console.log("2 - GetMaxShelfQuantity check 2: " + data + " of type " + data.typeof)
                    return resolve(-1); // -1 if doesn't exist 
                }
            });
        });
    }
    
    // method to update the inventory table 
    let UpdateItemInventory = (store_id, sku, quantity, overstock) => {
        return new Promise((resolve, reject) => {
            // console.log("Update input items --> store_id: "+ store_id+", sku: "+sku+", quantity: "+quantity+", overstock: "+overstock)
            pool.query("UPDATE inventory SET quantity=?, overstock=? WHERE store_id=? AND sku=?", [quantity, overstock, store_id, sku], (error, rows) => {
                if (error) { return reject(error); }
                // get infomation on query from rows and put into data
                let data = JSON.parse(JSON.stringify(rows));
                if ((rows) && (data.affectedRows == 1)) {
                    console.log("Updating check 1: "+ data.message)
                    return resolve(true); // TRUE if does exist
                }
                else {
                    console.log("Updating check 2: "+ data.message)
                    return resolve(false); // REJECT if couldn't update WAIT TO CHECK
                }
            });
        });
    }

    // method for calculating new quantity and overstock values
    let CalculateItemInventoryValues = (shelfMaximum, currentShelf, currentOverstock) => {

        // calculate inventory table stock values
        let fillShelf = 0;
        let fillOverstock = 0;
        let fillSpots = shelfMaximum - currentShelf; 

        // Case: shelf and overstock can all fit on the shelf
        if (fillSpots >= currentOverstock) {
            fillShelf = currentShelf + currentOverstock; 
        }
        // Case: Does not all fit on the shelf
        else {
            fillShelf = shelfMaximum; 
            fillOverstock = currentOverstock - fillSpots;
        }
        return [fillShelf, fillOverstock];
        
    }

    // math and temp storage variables 
    let maxShelfQuantity = 0;
    let store_id = info.store_id; 
    console.log("FROM JSON got store_id: "+ store_id)
    
    try { 
        console.log("E2")
        
        const exists = await CheckExistence(store_id);
        console.log("E3")
        
        if (exists) {
            
            // console.log("inventory exists")
            const itemList = await GetStoreItems(store_id); 
            console.log("E4") 
            if (itemList == -1) {
                response.error = "Could not get items in store "+store_id;
                response.statusCode = 400;
            }
            
            for(var i = 0; i < itemList.length ; i++) {
                let sku = itemList[i].sku;
                let quantity = itemList[i].quantity; 
                let overstock = itemList[i].overstock; 
                // console.log("INVENTORY: "+i+"  item "+sku+" quantity "+quantity+" overstock "+overstock)
                
                console.log("E5."+i+" LOOP For item : "+sku)
                    
                const maxShelfQuantity = await GetMaxShelfQuantity(sku); 
                console.log("E6."+i+"  - "+maxShelfQuantity)
                if (maxShelfQuantity === -1) {
                    response.error = "Failed to get item "+sku+" maximum shelf quantity. "; 
                    response.statusCode = 400; 
                } 
                    
                if (overstock !== 0  && quantity !== maxShelfQuantity) {
                    console.log("E7."+i)
                    const updateValues = CalculateItemInventoryValues(maxShelfQuantity, quantity, overstock);
                    let fillShelf = updateValues[0];
                    let fillStock = updateValues[1];
                    console.log("E8."+i+"  -- fill values are: "+fillShelf+" and "+fillStock)
                    
                    const updated = await UpdateItemInventory(store_id, sku, fillShelf, fillStock); 
                    console.log("E9."+i+" -- updated: "+updated)
                    if (!updated) {
                        response.error = "Failed to fill shelves for item "+sku;
                        response.statusCode = 400; 
                    }
                    else {
                        response.statusCode = 200; 
                    }
                }
                else {
                    console.log("XX - Item "+sku+" is already filled are there are none in overstock.")
                }
            }
            // if status is not 200, no updates have been made and request was useless
            if (response.statusCode !== 200){
                console.log("ERROR: There is nothing to fill ")
                response.statusCode = 400; 
                response.error = "There is nothing to fill at store "+store_id; 
            }
            // response.statusCode = 200; 
        }
        else { 
            response.error = "Store "+store_id+" has no inventory or may not exist.";
            response.statusCode = 400; 
        }
    } catch(error) {
        console.log("ERROR: " + error);
        response.statusCode = 400;
        response.error = error;
        
    }
  
    console.log("RESPONSE FINAL : "+ JSON.stringify(response.statusCode))
    
return response;
};