# kinesisoperations
Node script to pull all operations and accounts from Kinesis Stellar Blockchain

Can specify which Kinesis chain to grab info via commandline. 

usage example "node index.mjs KAU"

Requires node and npm. 

Run npm install on directory to get dependencies.  Uses axios for network connect and csv to write the csv.  Depending on which URL you pull will write to operations.csv in current directory
