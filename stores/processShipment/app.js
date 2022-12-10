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

    // method to get the item max shelf quantity 
    let GetMaxShelfQuantity = (sku) => {
        console.log("maxShelf input sku: "+sku)
        return new Promise((resolve, reject) => {
            pool.query("SELECT max_quantity_per_shelf FROM items WHERE sku=?", [sku], (error, data) => {
                if (error) { return reject(error); }
        // CHANGE UPDATE IF STATEMENT ?
                if ((data) && (data.length == 1)) {
                    let sdata = JSON.stringify(data); 
                    let psdata = JSON.parse(sdata.slice(1, -1)); 
                    let max = psdata.max_quantity_per_shelf;
                    // console.log("parsed max shelf quantity: "+max) 
                    
                    return resolve(max); // returns max shelf quantity if does exist
                }
                else {
                    console.log("Get max shelf quantity data2: " + data + " of type " + data.typeof)
                    return resolve(-1); // -1 if doesn't exist 
                }
            });
        });
    }

    // method to check if the store has that sku in inventory
    let CheckExistence = (store_id, sku) => {
        return new Promise((resolve, reject) => {
            pool.query("SELECT * FROM inventory WHERE store_id=? AND sku=?", [store_id, sku], (error, rows) => {
                if (error) { return reject(error); }
                if ((rows) && (rows.length == 1)) {
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

    // method to insert sku in store inventory if it is not yet in table
    let InsertItemInventory = (store_id, sku, quantity, overstock) => {
        return new Promise((resolve, reject) => {
            pool.query("INSERT INTO inventory (store_id,sku,quantity,overstock) VALUES(?,?,?,?)", [store_id, sku, quantity, overstock], (error, rows) => {
                if (error) { return reject(error); }
                // get information on the query results from rows into data 
                let data = JSON.parse(JSON.stringify(rows));
                if ((rows) && (data.affectedRows == 1)) {
                    console.log("Insertion check 1: "+ JSON.stringify(rows))
                    return resolve(true); // TRUE if was able to add
                }
                else {
                    console.log("Insertion check 2: "+ JSON.stringify(rows))
                    return resolve(false); // REJECT if couldn't add  WAIT TO CHECK
                }
            });
        });
    }
    
        // method to get the item max shelf quantity 
    let GetCurrentInventory = (store_id, sku) => {
        console.log("current inventory store_id: "+store_id+" and sku: "+sku)
        return new Promise((resolve, reject) => {
            pool.query("SELECT quantity, overstock FROM inventory WHERE store_id=? AND sku=?", [store_id, sku], (error, data) => {
                if (error) { return reject(error); }
                if ((data) && (data.length == 1)) {
                    
                    let sdata = JSON.stringify(data); 
                    let psdata = JSON.parse(sdata.slice(1, -1)); 
                    console.log("Get current Inventory: "+psdata+" of type : "+psdata.typeof)
                    
                    let quantity = psdata.quantity;
                    let overstock = psdata.overstock;
                    
                    console.log("parsed variables quant: "+quantity+" and overstock: "+overstock) 
                    let currentVals = [quantity, overstock]; 
                    
                    return resolve(currentVals); // returns array of the current inventory values
                }
                else {
                    console.log("ELSE Get current inventory data2: " + data + " of type " + data.typeof)
                    return resolve(-1); // 0 if doesn't exist 
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
                    console.log("Updating check 1: "+ JSON.stringify(rows))
                    return resolve(true); // TRUE if does exist
                }
                else {
                    console.log("Updating check 2: "+ JSON.stringify(rows))
                    return resolve(false); // REJECT if couldn't update WAIT TO CHECK
                }
            });
        });
    }

    // method for calculating quantity and overstock 
    let CalculateItemInventoryValues = (palletQuantity, shelfMaximum, currentShelf, currentOverstock) => {

        // calculate inventory table stock values
        let fillShelf = 0;
        let fillOverstock = 0;
        palletQuantity = parseInt(palletQuantity);
        
        // Case: when there is no current inventory/stock at the store
        if (currentShelf == 0 && currentOverstock == 0) {
            if (shelfMaximum >= palletQuantity) {
                fillShelf = palletQuantity;
            }
            else {
                fillShelf = shelfMaximum;
                fillOverstock = palletQuantity - shelfMaximum;
            }
            console.log("Calculate values check 1--> shelves: " + fillShelf + " and overstock " + fillOverstock);
            return [fillShelf, fillOverstock];
        }

        // available is the potential filling space on the shelf
        let available = shelfMaximum - currentShelf;
        
        console.log("CALCULATE: var values -> available: "+available+", currentShelf: "+currentShelf+", shelfMax: "+shelfMaximum+"palletQ: "+palletQuantity)
        // Case: all items from shipment fit on the shelf space 
        if (palletQuantity < available) {
            console.log("CALCULATE: palletQuantity < available")
            fillShelf = currentShelf + palletQuantity;
            fillOverstock = currentOverstock;
        }
        // Case: not all shipment items (if any) fit on the shelf
        else {
            console.log("CALCULATE: else: ")
            palletQuantity -= available;
            fillShelf = shelfMaximum;
            fillOverstock = currentOverstock + palletQuantity;
        }
        console.log("Calculate values check 2 for shelves: " + fillShelf + " and overstock " + fillOverstock);
        return [fillShelf, fillOverstock] ;
    }

    // math and temp storage variables 
    let maxShelfQuantity = 0;
    
    for (var p = 0; p < info.shipments.length ; p++) {
        let pallet = info.shipments[p]; 
        let sku = pallet.sku; 
        let store_id = pallet.store_id; 
        let quantity = pallet.quantity; 
        console.log(" Just the pallet: "+ pallet)
        
        console.log("For loop pallet: store "+store_id+", sku "+ sku + ", and quantity "+quantity)

        console.log("Tryingggggggggggg for pallet: "+p)
        try {
            console.log("E1");
            const maxShelfQuantity = await GetMaxShelfQuantity(sku);
    
            if (maxShelfQuantity !== -1) {
                console.log("MAX SHELF val: "+ parseInt(maxShelfQuantity) + " of type "+ parseInt(maxShelfQuantity).typeof)
                console.log("Got Max shelf : " + maxShelfQuantity);
            }
            else {
                response.statusCode = 401;
                response.error = "Couldn't retrieve item " + sku + " max shelf quantity";
            }
    
            console.log("E2");
            const exists = await CheckExistence(store_id, sku);
    
            console.log("E3");
            if (exists) {
                console.log("Enter Exists")
                // get current tables stock values 
                const currentValues = await GetCurrentInventory(store_id, sku); 
                if (currentValues == -1) {
                    response.error = "Count not get current stock for item "+sku+" in store "+store_id; 
                    response.statusCode = 400; 
                } 
                
                let currentQuantity = parseInt(currentValues[0]); 
                let currentOverstock = parseInt(currentValues[1]); 

                // calculate new update values 
                const fillValues = CalculateItemInventoryValues(quantity, maxShelfQuantity, currentQuantity, currentOverstock); 
                let fillQuantity = fillValues[0]; 
                let fillOverstock = fillValues[1]; 
                console.log("Calculated new fill values for update: quant "+fillQuantity+" and over "+fillOverstock)
                
                // UPDATE inventory
                console.log("E4")
                const updated = await UpdateItemInventory(store_id, sku, fillQuantity, fillOverstock);
                console.log("E5");
                if (updated) {
                    response.statusCode = 200;
                }
                else {
                    response.statusCode = 400;
                    response.error = "Couldn't update store " + store_id + " for item " + sku;
                }
            }
            else {
                console.log("E6");
    
                // calculate inventory table stock values for no current item inventory
                const fillVals = await CalculateItemInventoryValues(quantity, maxShelfQuantity, 0, 0);
                let fillShelf = fillVals[0]; 
                let fillOverstock = fillVals[1];
                console.log("NEW row fill values for shelf: "+fillShelf+" and overstock: "+fillOverstock)
    
                // insert row into inventory table 
                const inserted = await InsertItemInventory(store_id, sku, fillShelf, fillOverstock);
                console.log("E7");
                if (inserted) {
                    response.statusCode = 200;
                }
                else {
                    response.statusCode = 400;
                    response.error = "Couldn't insert in store " + store_id + " the item " + sku;
                }
            }
        }
        catch (error) {
            console.log("ERROR: " + error);
            response.statusCode = 400;
            response.error = error;
        }
    }
    console.log("RESPONSE FINAL : "+response + " status "+ JSON.stringify(response.statusCode))
    
return response;
};