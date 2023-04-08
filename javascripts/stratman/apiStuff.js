// following three lines + func were just in stratman.js
// remove / enable checkbal button depending on offline status
const checkBal = document.getElementById('getBal');
const showBal = document.getElementById('showBal');
checkBal.addEventListener('click', function() {
    if (tempStrat.token[0] == 'kraken'){
        const nonce = GetNonce();
        axios({
            method: 'post',
            url: 'https://api.kraken.com/0/private/Balance',
            data: qs.stringify({
                'nonce': nonce
            }),
            headers: {
                'API-Key': tempStrat.token[1].key,
                'API-Sign': getMessageSignature('/0/private/Balance', {'nonce': nonce}, tempStrat.token[1].secret, nonce),
                'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                'user-agent': 'Node.js app'
            }
        })
        .then((response) => {
            console.log(response.data);
            if (response.data.error.length > 0) {
                showBal.innerHTML = JSON.stringify(response.data.error, null, 2);
            } else {
                showBal.innerHTML = JSON.stringify(response.data.result, null, "\t");
            }
        })
        .catch((error) => {
            alert(error);
        });
    }
    else if (tempStrat.token[0] == 'td') {
        // TODO: td ameritrade balances
        console.log('hasnt been coded yet');
    }
});


const getMessageSignature = (path, request, secret, nonce) => {
    const message = qs.stringify(request);
    const secret_buffer = Buffer.from(secret, 'base64');
    const hash = new crypto.createHash('sha256');
    const hmac = new crypto.createHmac('sha512', secret_buffer);
    const hash_digest = hash.update(nonce + message).digest('binary');
    const hmac_digest = hmac.update(path + hash_digest, 'binary').digest('base64');
    
    return hmac_digest;
};
function GetNonce () {
    return Math.floor(+new Date() / 1000);
}

function GetTheCandles(pa, chartNum) {
    /**
     * This function connects to the desired api to retrieve history, and formats it to make it universal.
     * TODO: find out how to plug in data
     */
    let interv = qm.ParseCandleInterval(chartList[chartNum].chartInterval);
    let intervalNum = interv[0];
    let intervalType = interv[1];
    if (intervalType == 'hour')
    {
        intervalType = 'minute';
        intervalNum *= 60;
    }

    if (tempStrat.token[0] == 'kraken') {
        
        //console.log(intervalNum);
        const nonce = GetNonce();
        if (pa == null) return;
        request = {
            'nonce': nonce,
            'pair': pa
        }
        
        axios({
            method: 'post',
            url: 'https://api.kraken.com/0/public/OHLC',
            data: qs.stringify({
                'nonce': nonce,
                'pair': pa,
                'interval': intervalNum
            }),
            headers: {
                'API-Key': tempStrat.token[1].key,
                'API-Sign': getMessageSignature('/0/public/OHLC', {
                    'nonce': nonce,
                    'pair': pa,
                    'interval': intervalNum
                }, tempStrat.token[1].secret, nonce),
                'content-type': 'application/x-www-form-urlencoded;charset=utf-8'/*,
                'user-agent': 'Node.js app'*/

            }
        })
        .then((response) => {
            res = response.data.result;
            //console.log(response.data);
            chartList[chartNum].InitData('kraken', Object.values(res)[0]);
        })
        .catch((error) => {
            console.log(error);
            alert(error);
        });
    }
    else if (tempStrat.token[0] == 'td') {

        //TODO: clean up. idk if this is the best way bc i forgot how async/promises/blocks or whateverthefuck work
        const getDat = () => {
            try {
                return axios.get(`https://api.tdameritrade.com/v1/marketdata/${pa}/pricehistory`, {
                    params: {
                        apikey: tempStrat.token[1].key, // I just guessed here
                        periodType: 'day',
                        period: '3',
                        frequencyType: intervalType,
                        frequency: intervalNum,
                        endDate: Date.now()
                    }
                })
            } catch (error) {
                console.error(error);
                alert(error);
            }
        }
        const getItMasteria = async () => {
            const thedat = getDat()
            .then(response => {
                //console.log(response.data);
                let res = response.data.candles;
                chartList[chartNum].InitData('td', res);
            })
            .catch(error => {
                console.log(error);
                alert(error);
            })
        }
        getItMasteria()
    }

}

module.exports = { GetTheCandles }