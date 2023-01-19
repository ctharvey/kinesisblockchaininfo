import * as csv from "csv";
import axios, { AxiosHeaders } from "axios";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

//set some basic info for function
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);

class kinesisChainURLs {
  constructor(chainType) {
    this.name = chainType;
    switch (chainType) {
      case "KAG":
        this.operations =
          "https://kag-mainnet-syd-horizon.kinesisgroup.io/operations?limit=200&order=desc";
        this.account =
          "https://kag-mainnet-syd-horizon.kinesisgroup.io/accounts/";
        break;
      case "KAU":
        this.operations =
          "https://kau-mainnet-syd-horizon.kinesisgroup.io/operations?limit=200&order=desc";
        this.account =
          "https://kau-mainnet-syd-horizon.kinesisgroup.io/accounts/";
        break;
    }
  }
}

var Kinesis_Chains = {
  KAU: new kinesisChainURLs("KAU"),
  KAG: new kinesisChainURLs("KAG"),
};

var operations = new Map();

var accountsRaw = new Set();

//format is <account id, account object>
var accountsMap = new Map();

var emptyAccounts = 0;

var validAccounts = 0;

var urls;

//todo add logic to give error on invalid chain
switch (args[0]) {
  case "KAU":
    urls = Kinesis_Chains.KAU;
    break;
  case "KAG":
    urls = Kinesis_Chains.KAG;
    break;
  default:
    urls = Kinesis_Chains.KAU;
    break;
}

//swap to KAGHorizon to grab KAG
getData(urls.operations);
// getAccount("GBUBOKEFUNF4ZZQA7QJCGYF54U4N2T5VV2QAN7RWQCVS75OOI5KSVCZS");

function getData(rootWWW) {
  getOperations(rootWWW, processRecord);
}

function getOperations(url, callback) {
  axios.get(url).then(function (response) {
    var self = response.data._links.self.href;
    var next = response.data._links.next.href;
    var records = response.data._embedded.records;
    records.forEach(function (record) {
      callback(record);
    });
    if (self === next) {
      prepareOperationsCSV();
      getAccounts();
    } else {
      //timeout of half a second between API hit to keep impact low
      setTimeout(() => {
        //output number of operations also to see it is continuing to download. Recursive download.
        console.log(accountsRaw.size);
        console.log(operations.size);
        getData(next);
      }, 500);
    }
  });
}

function getAccounts() {
  //clear undefined, null, etc
  accountsRaw = new Set([...accountsRaw].filter((elm) => elm));
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  var accounts = [...accountsRaw];
  //use promises so we wait for the previous account to finish and don't pummel the api
  for (let i = 0, p = Promise.resolve(); i < accountsRaw.size; i++) {
    p = p
      .then(() => delay(50))
      .then(() => getAccount(accounts[i]))
      //lazy fix to grab last entry otherwise will finish before async finishes
      .then(() => delay(50))
      .then(() => {
        //output every 10 to be clear its still running
        if (i % 10 == 0) {
          console.log("Account number " + i + " out of " + accountsRaw.size);
        }
        if (i === accountsRaw.size - 1) {
          prepareAccountsCSV();
        }
      });
  }
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
  var trans = new Transaction(record);
  //add all different types of records to the accounts list
  accountsRaw.add(trans.sourceAccount);
  accountsRaw.add(trans.from);
  accountsRaw.add(trans.to);
  accountsRaw.add(trans.account);
  accountsRaw.add(trans.funder);
  accountsRaw.add(trans.into);
  //originally was getting duplicate transactions in an array so swapped to map for lazyiness and only one instance of each id
  operations.set(record.id, trans);
}

function getAccount(accountID) {
  class Account {
    constructor(account) {
      this.id = account.account_id;
      this.lastModified = account.last_modified_time;
      this.balance = account.balances[0].balance;
    }
  }
  axios
    .get(urls.account + accountID)
    .then(function (response) {
      var account = new Account(response.data);
      accountsMap.set(accountID, account);
    })
    .catch(function (error) {
      if (error.response) {
        // console.log(error.response.status);
      } else if (error.request) {
        console.log(error.request);
      } else {
        console.log("Error", error.message);
      }
    });
}

//add header to csv and output data to file in same directory as script
function prepareOperationsCSV() {
  var it = operations.entries();
  var transaction = it.next().value[1];
  var columns = Object.keys(transaction);
  prepareCSV(columns, [...operations.values()], urls.name + "operations.csv");
}

//add header to csv and output data to file in same directory as script
function prepareAccountsCSV() {
  var it = accountsMap.entries();
  var transaction = it.next().value[1];
  var columns = Object.keys(transaction);
  prepareCSV(columns, [...accountsMap.values()], urls.name + "accounts.csv");
}

//abstract reused csv code
function prepareCSV(columns, values, filename) {
  csv.stringify(
    values,
    {
      header: true,
      columns: columns,
    },
    function (err, data) {
      fs.writeFile(__dirname + "/" + filename, data, (err) => {
        if (err) {
          console.error(err);
        }
      });
    }
  );
}

// var endOfLine =
//   "https://kau-mainnet-syd-horizon.kinesisgroup.io/operations?cursor=623835409813505&limit=100&order=desc";
