// This is universal, works with Infura -- set provider accordingly

const ethers = require('ethers')
//const provider = ethers.getDefaultProvider('rinkeby')
const AVAX_URL = 'https://api.avax.network/ext/bc/C/rpc';
const provider = new ethers.providers.JsonRpcProvider(AVAX_URL)

function hex_to_ascii(str1) {
	var hex  = str1.toString();
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
 }

async function reason() {
    var args = process.argv.slice(2)
    let hash = args[0]
    console.log('tx hash:', hash)
    console.log('provider:', AVAX_URL)

    let tx = await provider.getTransaction(hash)
    if (!tx) {
        console.log('tx not found')
    } else {
        // console.log('calling tx:', tx);
        delete tx.maxFeePerGas;
        delete tx.maxPriorityFeePerGas;
        let code = await provider.call(tx, tx.blockNumber)
        let reason = hex_to_ascii(code.substr(138))
        console.log('revert reason:', reason)
    }
}

reason()