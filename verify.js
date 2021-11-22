const ethers = require('ethers');
const fs = require('fs');
const { exit } = require('process');

const EIP1271_ABI = [
    "function isValidSignature(bytes32 _hash, bytes memory signature) public view returns(bytes4)"
];
const EIP1271_MAGIC_NUMBER = 0x1626ba7e;

let provider = undefined;
if(process.env.WEB3_PROVIDER_URL !== undefined) {
    provider = new ethers.providers.JsonRpcProvider(process.env.WEB3_PROVIDER_URL);
}

function formatVotes(totals, sum, count, unknown) {
    const percent_totals = totals.map((total) => total / sum);
    return `${count} votes (${ethers.utils.commify(sum.toFixed(0))} ENS): 1. ${(percent_totals[0] * 100).toFixed(2)}% 2. ${(percent_totals[1] * 100).toFixed(2)}% 3. ${(percent_totals[2] * 100).toFixed(2)}% 4. ${(percent_totals[3] * 100).toFixed(2)}% Unknown: ${(100 * unknown / sum).toFixed(2)}%`;
}

const START_BLOCK = 13578556;
const END_BLOCK = 13623374;
const knownBlocks = {};
async function findClosestBlock(timestamp, startBlock=START_BLOCK, endBlock=END_BLOCK) {
    const mid = Math.trunc((startBlock + endBlock) / 2);
    if(mid == startBlock) {
        return startBlock;
    }
    let ts = knownBlocks[mid];
    if(ts === undefined) {
        ts = knownBlocks[mid] = (await provider.getBlock(mid)).timestamp;
    }
    if(timestamp < ts) {
        return findClosestBlock(timestamp, startBlock, mid);
    } else if(timestamp == ts) {
        return mid;
    } else {
        return findClosestBlock(timestamp, mid, endBlock);
    }
}

async function checkContractSignature(address, hash, sig, timestamp) {
    if(provider === undefined) {
        return undefined;
    }
    const blockno = await findClosestBlock(timestamp);
    const contract = new ethers.Contract(address, EIP1271_ABI, provider);
    try {
        return (await contract.isValidSignature(hash, sig, {blockTag: blockno})) == EIP1271_MAGIC_NUMBER;
    } catch(e) {
        throw new Error(`Verifying at block ${blockno}: ${e.toString()}`);
    }
}

async function verifyVote(vote) {
    let {address, msg, sig, data} = JSON.parse(fs.readFileSync(`votes/${vote.ipfs}`, {encoding: 'utf-8'}));
    if(address.toLowerCase() != vote.voter.toLowerCase()) {
        throw new Error(`Signer address ${address} in ${vote.ipfs} does not match voter ${vote.voter}`);
    }
    let hash, choices;
    
    if(data !== undefined) {
        // Handle old signing format
        hash = ethers.utils._TypedDataEncoder.hash(data.domain, data.types, data.message);
        choices = data.message.choice;
    } else {
        hash = ethers.utils.hashMessage(msg);
        choices = JSON.parse(msg).payload.choice;
    }

    const recovered = ethers.utils.recoverAddress(hash, sig.substring(0, 132)).toLowerCase();
    if(recovered !== address.toLowerCase()) {
        const valid = await checkContractSignature(address, hash, sig, vote.created);
        if(valid === undefined) {
            console.log(`\nNo archive node access; cannot check signature on ${vote.ipfs}`)
            return undefined;
        } else if(valid === false) {
            throw new Error(`Invalid signature in ${vote.ipfs}: expected signer ${address} but got ${recovered}`);
        }
    }

    return choices;
}

async function main() {
    const totals = [0, 0, 0, 0];
    let sum = 0;
    let count = 0;
    let unknown = 0;

    const votes = fs.readFileSync('constitution-votes.jsonl', {encoding: 'utf-8'}).split('\n').map((line) => JSON.parse(line));
    for(const vote of votes) {
        const balance = parseFloat(vote.vp);
        try {
            const choices = await verifyVote(vote);
            if(choices !== undefined) {
                for(const item of choices) {
                    totals[item - 1] += balance;
                }
        
                if((count % 100) == 0) {
                    process.stdout.write('\r' + formatVotes(totals, sum, count, unknown));
                }        
            } else {
                unknown += balance;
            }
        } catch(e) {
            console.log(`\nError verifying ${vote.ipfs}: ${e.toString()}`);
            // exit(1);
            unknown += balance;
        }
        count += 1;
        sum += balance;
    }
    process.stdout.write('\r' + formatVotes(totals, sum, count, unknown) + '\n');
}

(async () => {
    try {
        await main();
    } catch(e) {
        console.log(e);
    }
})();
