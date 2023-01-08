import * as csv from "csv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { exit } from "process";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

var KAUHorizon =
  "https://kau-mainnet-syd-horizon.kinesisgroup.io/operations?limit=200&order=desc";

var KAGHorizon =
  "https://kag-mainnet-syd-horizon.kinesisgroup.io/operations?limit=200&order=desc";
var endOfLine =
  "https://kau-mainnet-syd-horizon.kinesisgroup.io/operations?cursor=623835409813505&limit=100&order=desc";

var operations = new Map();

//swap to KAGHorizon to grab KAG
getData(KAUHorizon);

function getData(rootWWW) {
  getURLContent(rootWWW, processRecord);
}

//create individual transaction for easier organization
function processRecord(record) {
  class Transaction {
    constructor(transactionData) {
      if (transactionData != null) {
        this.id = transactionData.id;
        this.transactionSuccessful = Boolean(
          transactionData.transaction_successful
        ).toString();
        this.sourceAccount = transactionData.source_account;
        this.type = transactionData.type;
        this.typeI = transactionData.type_i;
        this.createdAt = transactionData.created_at;
        this.transactionHash = transactionData.transaction_hash;
        this.assetType = transactionData.asset_type;
        this.from = transactionData.from;
        this.to = transactionData.to;
        this.amount = transactionData.amount;
        this.account = transactionData.account;
        this.into = transactionData.into;
        this.startingBalance = transactionData.starting_balance;
        this.funder = transactionData.funder;
        this.signerKey = transactionData.signerKey;
        this.signerWeight = transactionData.signerWeight;
      }
    }
  }
  //originally was getting duplicate transactions in an array so swapped to map for lazyiness and only one instance of each id
  operations.set(record.id, new Transaction(record));
}

//grab all transactions from url and then pass to callback function
function getURLContent(url, callback) {
  axios.get(url).then(function (response) {
    var self = response.data._links.self.href;
    var next = response.data._links.next.href;
    var records = response.data._embedded.records;
    records.forEach(function (record) {
      callback(record);
    });
    if (self === next) {
      prepareCSV();
      exit;
    } else {
      //timeout of half a second between API hit to keep impact low
      setTimeout(() => {
        //output number of operations also to see it is continuing to download.
        console.log(operations.size);
        getData(next);
      }, 500);
    }
  });
}

//add header to csv and output data to file in same directory as script
function prepareCSV() {
  var it = operations.entries();
  var transaction = it.next().value[1];
  var columns = Object.keys(transaction);
  csv.stringify(
    //convert object to array of keys from transaction object
    [...operations.values()],
    {
      header: true,
      columns: columns,
    },
    function (err, data) {
      fs.writeFile(__dirname + "/operations.csv", data, (err) => {
        if (err) {
          console.error(err);
        }
      });
    }
  );
}
