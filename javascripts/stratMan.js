/**
 * Ctrl-z ?
 * indicators not loading in until shit is changed
 * ask if u wanna save before closing window ?
 * obvsly loading in data
 */

const styling = require('./javascripts/stratManStylizing.js');
const graphElements = require('./javascripts/stratman/graphElements.js');
const fs = require('fs');

const path = require('path');
const electron = require('electron');
const {ipcRenderer} = electron;
const axios = require('axios');
const qs = require('qs');
const crypto = require('crypto');
const { start } = require('repl');
const { Console } = require('console');
var inputWindow = null;

var chartList = [];
var buyStratComparisons = {};
var sellStratComparisons = {};
var stopLossComparisons = {};
// buyStratDivList allows us to find index of shit in buystratcomparisons
var buyStratDivList = [];
var sellStratDivList = [];

// indicatorDivList allows us to find the index of indicator in tempstrat.indicators
var indicatorDivList = [];

var apiTokens = {};
var selectedKrakenToken = {};
// initialized at bottom
var krakenPairList = [];

const apiSelector = document.getElementById('apisel');
const stratSelector = document.getElementById('stratDropdown');
const shortingElement = document.getElementById('shortingBool');

// tempStrat.buyStratBp puts the strat in order
// [{first, second, etc}, '&&', {first, second, etc}]
const blankStrat = {
    token: {},
    charts: [{pair: ""},{pair: ""}],
    indicators: [],
    buyStratBP: [],
    sellStratBP: [],
    shorting: false
};
var tempStrat = JSON.parse(JSON.stringify(blankStrat));

// gets updated on saves, deletions, and page load
var strategies = {};

// gonna have a button to draw. what if u just wanna be chartgazing without clutter yaknow?
var drawingStrat = true;

// loading in list of stocks
var pairListResults = [];
var runningList = false;
var pairListSize = 0;

// this retrieves apiList data from main, sent to 'api-data'
ipcRenderer.send('give-api-data');
// TODO: when you can delete apis, you shouldn't just erase the selector html. you need to have the names saved 
// of the tokens so the selection's not being indexed on the select tag, rather it's selecting the name
ipcRenderer.on('api-data', function(e, data) {
    // data is an object
    apiTokens = data;
    // idk why i did this
    // First clear inner html
    //apiSelector.innerHTML = '';

    // Add to dropdown menu
    // make it so dropdown has kraken and td ameritrade headers
    for (let apiType in apiTokens) {
        for (let tok = 0; tok < apiTokens[apiType].length; tok++) {
            let name = apiTokens[apiType][tok].name;
            const option = document.createElement('option');
            // will be 'krakenreal' etc
            option.value = apiType + name;
            // 'krakenToken' etc
            option.className = apiType + 'Token';
            // 'kraken:real etc
            const txt = document.createTextNode(apiType + ':' + name);
            option.appendChild(txt);
            apiSelector.appendChild(option);
        }
    }

    // Load the token when it starts. from here on out we update tempstrat.token
    // every time the selection changes. (in changetoken())
    tempStrat.token = GetSelectedToken();
});

ipcRenderer.send('give-strat-data');
ipcRenderer.on('strat-data', function(e, strats) {
    /**
     * Initialize the saved strategies.
     */
    let names = Object.keys(strats);
    strategies = strats;
    UpdateStrategySelector(names);
});

/****************************************************************************************************
 *                                      Start of element functions etc
*****************************************************************************************************
****************************************************************************************************/

//checkbox for shorting
shortingElement.addEventListener('change', function(e) {
    //update tempstrat then file
    tempStrat.shorting = shortingElement.checked;
    ipcRenderer.send('currentStrat:updateFile', tempStrat);

});

// but delete it after you change the calls to it and getselected a bgit
function ChangeToken() {
    // nice
    tempStrat.token = GetSelectedToken();
    //Overwrite whole file
    ipcRenderer.send('currentStrat:updateFile', tempStrat);
}

// might make changetoken useless
function GetSelectedToken() {
    /**
     * Returns selected token data ['kraken', {name: "real", key: "aifjoaifj", secret: "ejifoasj"}] etc
     */
    let className = apiSelector.options[apiSelector.selectedIndex].className;
    if (className == "none") return ["none"];
    let tokType = className.slice(0,-5);
    for (let tok = 0; tok < apiTokens[tokType].length; tok++) {
        if (tokType + apiTokens[tokType][tok].name == apiSelector.value) {
            console.log([tokType, apiTokens[tokType][tok]]);
            return [tokType, apiTokens[tokType][tok]];
        }
    }
}


GetKrakenPairs();
function GetKrakenPairs() {
    axios.get('https://api.kraken.com/0/public/AssetPairs')
    .then((response) => {
        if (response.data.error.length > 0) {
            console.log(response.data.error);
        } else {
            var dat = response.data.result;
            for (let itm in dat) {
                krakenPairList.push(dat[itm].altname);
            }
        }
    })
    .catch((error) => {
        alert(error);
    });
}

function ShallowEqual(obja, objb) {
    /**
     * Checks if two objects have equal contents.
     */
    let keysa = Object.keys(obja);
    let keysb = Object.keys(objb);

    if (keysa.length != keysb.length) return false;
    for (let k of keysa) {
        if (obja[k] != objb[k]) return false;
    }
    return true;
}

function ChangeStrat() {
    /**
     * When strategy is changed thru dropdown menu.
     * if tempstrat is blank or equals another saved strat, we won't ask
     * for confirmation to change.
     */
    let stratsKeys = Object.keys(strategies);
    let stratIsSaved = false;
    for (let j of stratsKeys) {
        //TODO: THE TWO SHALLOWEQUAL CALLS BELOW WON'T WORK
        //ONCE THE OBJECTS GET MORE COMPLEX
        if (ShallowEqual(tempStrat, strategies[j])) {
            stratIsSaved = true;
            console.log('strat is saved');
            console.log(tempStrat);
            console.log(strategies[j]);
            break;
        }
    }
    if (!ShallowEqual(tempStrat, blankStrat) && !stratIsSaved) {
        if (!window.confirm('Change strat without saving?')) return;
    }
    let sName = stratSelector.value;
    let stratObj;
    if (sName == '') {
        stratObj = JSON.parse(JSON.stringify(blankStrat));
    }
    else {
        //Preventing object reference
        stratObj = JSON.parse(JSON.stringify(strategies[sName]));
    }
    LoadStrategy(stratObj, sName=='');
}

function LoadTempStrat() {
    ipcRenderer.send('loadTempStrat');
}
ipcRenderer.on('tempStratSuccess', function(e, stratObj) {
    LoadStrategy(stratObj);
});

function LoadStrategy(stratObj, resetting=false) {
    /**
     * takes a strategy object and loads in
     * all the params.
     */
    // set the var
    tempStrat = JSON.parse(JSON.stringify(blankStrat));
    tempStrat.shorting = stratObj.shorting;
    console.log(stratObj)
    //tempStrat.buyStratBP = [];
    //tempStrat.sellStratBP = [];
    
    // write to tempstrat file
    if (!resetting) ipcRenderer.send('currentStrat:updateFile', stratObj);
    // load token
    // This will bring 'krakentokenname' etc
    if (!resetting) apiSelector.value = stratObj.token[0] + stratObj.token[1].name;
    tempStrat.token = GetSelectedToken();

    // load pair/graph
    // delete first
    for (let i = 0; i < chartList.length; i++) {
        chartList[i].RemoveHTML();
    }
    numOfCharts = 0;
    chartList = [];
    for (let thing = 0; thing < stratObj.charts.length; thing++) {
        CreateAChart(stratObj.charts[thing]);
    }

    // reset then load indicators
    for (let thing = 0; thing < indicatorDivList.length; thing++) {
        RemoveIndicatorHTML(indicatorDivList[thing]);
    }
    indicatorDivList = [];
    for (let thing = 0; thing < stratObj.indicators.length; thing++) {
        AddIndicator(stratObj.indicators[thing].type, stratObj.indicators[thing].params, true);
    }
    
    //TODO: save window scroll/zoom

    // Load bottom strategy
    shortingElement.checked = tempStrat.shorting;
    // generate strats
    GenerateLowerStrategy(stratObj.buyStratBP, stratObj.sellStratBP, true);
}

function SaveStrategy() {
    if (inputWindow == null || inputWindow.closed) {
        inputWindow = window.open(path.join(__dirname, '..', 'ALGOTRADE', `inputdialogue.html?name=${stratSelector.value}`), 'modal');
    }
}
ipcRenderer.on('savedStrategy', function(e, strats, currentStrat) {
    /**
     * Strategy was saved, now we need to update
     */
    let names = Object.keys(strats);
    strategies = strats;
    console.log('strategies now');
    console.log(strategies);
    UpdateStrategySelector(names);
    stratSelector.value = currentStrat;
});
function UpdateStrategySelector(names) {
    /**
     * Clears the strategy selector options and updates
     */
    for (var i = stratSelector.options.length -1; i >= 0; i--) {
        stratSelector.remove(i);
    }
    let opEl = document.createElement('option');
    opEl.value = '';
    opEl.innerHTML = 'New';
    stratSelector.appendChild(opEl);
    for (i = 0; i < names.length; i++) {
        opEl = document.createElement("option");
        opEl.value = names[i];
        opEl.innerHTML = names[i];
        stratSelector.appendChild(opEl);
    }
}

function DeleteCurrentStrat() {
    /**
     * When the delete button is clicked
     * if strat is loaded, ask if you're sure you want to delete
     * Then update tempstrat, strategies variable and file,
     * update stratdropdown, and reset screen
     * 
     * tempstrat file is only reset after a change is made, that way
     * you still have one more chance to get strategy back
     */
    if (stratSelector.value == ""){
        alert("You don't have a strategy loaded!");
        return;
    }
    if (!window.confirm("Are you sure you want to delete strategy " + stratSelector.value + "?")) {
        return;
    }
    tempStrat = JSON.parse(JSON.stringify(blankStrat));
    delete strategies[stratSelector.value];
    // will update strategies file
    ipcRenderer.send('strategies:delete', strategies);
    //dropdown
    UpdateStrategySelector(Object.keys(strategies));
    stratSelector.value = '';

    LoadStrategy(tempStrat, true);
}


ipcRenderer.on('alert', function(e, msg) {
    alert(msg);
});

function AddIndicator(ind, savedParams = null, doNotWriteFile = false) {
    console.log(ind);
    var newDiv;
    let indicator;
    var container = document.getElementById("indicatorList");
    var indButton = document.getElementById("adder");
    switch (ind) {
        case 'MA':
            let paramtrs = savedParams;
            if (!savedParams) {
                let defaultPeriod = 5;
                paramtrs = {
                    period: defaultPeriod,
                    color: '#000000'
                };

            }
            indicator = {
                type: ind,
                params: paramtrs
            };
            newDiv = CreateIndDiv("Moving Average", paramtrs);

            break;
        default:
            break;
    }
    container.insertBefore(newDiv, indButton);
    indicatorDivList.push(newDiv);
    if (!doNotWriteFile) { // As of rn, this means we just clicked the button to add indicator (not loading)
        //THIS IS THE FUCKING CULPRIT DGODDAMNNN
        tempStrat.indicators.push(indicator);
        ipcRenderer.send('currentStrat:updateFile', tempStrat);

        // and now update the lower strat. I technically could go in and just add to each div's
        // individual select element, but fuck that. just reset whole thing
        GenerateLowerStrategy(tempStrat.buyStratBP, tempStrat.sellStratBP);

    }

    // POSSIBLE CHART OPTIMIZE - when loading a strat
    // if chart exists, update indicators
    for (let i = 0; i < chartList.length; i++) {
        if (chartList[i].parsedDat.length == 0) continue;
        chartList[i].UpdateIndicatorDat();
    }
    //UpdateIndicatorDivs();
}

function CreateIndDiv(title, indicatorParams) {
    var newDiv = document.createElement("div");
    newDiv.className = "indBox";
    var divTitle = document.createElement("div");
    divTitle.className = "indBoxTitle";
    divTitle.innerHTML = "<p>" + title + "</p>";
    var indDelButt = document.createElement("div");
    indDelButt.className = "indDel";
    indDelButt.innerHTML = "del";

    indDelButt.addEventListener('click', function(e) {
        DeleteIndicator(newDiv);
    });


    divTitle.appendChild(indDelButt);
    newDiv.appendChild(divTitle);

    for (const [key, value] of Object.entries(indicatorParams)) {
        var paramContainerDiv = document.createElement('div');
        paramContainerDiv.style.width = '100%';
        let displayAndForm = CreateTextInputForm(newDiv, key, value);
        paramContainerDiv.innerHTML += "<p>" + key + ": </p>";
        paramContainerDiv.appendChild(displayAndForm[0]);
        paramContainerDiv.appendChild(displayAndForm[1]);
        newDiv.appendChild(paramContainerDiv);

    }
    

    return newDiv;
}
//dont think i will need this 6/4/21
/*
function UpdateIndicatorDivs() {
    for (var div in indicatorDivList) {
        indicatorDivList[div].id = "indicator" + div;
    }
}
*/
/// Create two elements. One to enter text and
function CreateTextInputForm(containr, paramName, defaultVal) {
    let isInt = (paramName == 'period');
    var displayDat = document.createElement('p');
    displayDat.innerHTML = defaultVal;

    var inpForm = document.createElement("form");
    var inpDiv = document.createElement("input");
    var inpSubDiv = document.createElement("input");
    inpDiv.type = "text";
    inpSubDiv.type = "submit";
    if (isInt)
        inpDiv.className = "numbInput";
    
    inpForm.style.display = 'none';
    inpForm.appendChild(inpDiv);
    inpForm.appendChild(inpSubDiv);


    inpForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (inpDiv.value == '') return;
        displayDat.innerHTML = inpDiv.value;
        inpForm.style.display = 'none';
        displayDat.style.display = 'inline';
        inpDiv.value = '';
        // update tempstrat var & file

        let saveVal = displayDat.innerHTML;
        // TODO: FIX this. BAD PRACTICE BRO
        // if the val is supposed to be int, make it an int
        if (isInt)
            saveVal = parseInt(saveVal);
        tempStrat.indicators[indicatorDivList.indexOf(containr)].params[paramName] = saveVal;
        ipcRenderer.send('currentStrat:updateFile', tempStrat);
        //if graph is up, you have to recalculate ma
        for (let i = 0; i < chartList.length; i++) {
            if (chartList[i].parsedDat.length == 0) continue;
            chartList[i].UpdateIndicatorDat(indicatorDivList.indexOf(containr));
        }
    });

    displayDat.addEventListener('click', function(e) {
        inpDiv.value = displayDat.innerHTML;
        displayDat.style.display = 'none';
        inpForm.style.display = 'inline';
        inpDiv.select();
        displayDat.innerHTML = '';
    });

    return [displayDat, inpForm];

}
function DeleteIndicator(divElement) {
    let tmpIndex = indicatorDivList.indexOf(divElement);
    // remove from tempstrat
    tempStrat.indicators.splice(tmpIndex, 1);
    // remove from list that gives index
    indicatorDivList.splice(tmpIndex, 1);
    // update temp file
    ipcRenderer.send('currentStrat:updateFile', tempStrat);

    // remove the calculated data list from chart
    for (let i = 0; i < chartList.length; i++) {
        if (chartList[i].parsedDat.length == 0) continue;
        chartList[i].UpdateIndicatorDat(tmpIndex, true);
    }
    // aaaand finally
    RemoveIndicatorHTML(divElement);
}
function RemoveIndicatorHTML(divElement) {
    divElement.remove();
}

// #############################################################################################
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

// #############################################################################################

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

function LoadPairList() {
    /**
     * Loads list of pairs in separate file
     * and runs them each without showing chart
     */
    // we not gonna draw for now
    // the final chart in list will activate
    drawingStrat = false;
    runningList = true;
    let dat = fs.readFileSync('./pairList.txt', 'utf-8').split(',');
    pairListSize = dat.length;
    for (let i = 0; i < dat.length; i++) {
        console.log(dat[i])
        let chat = new Chart();
        chat.pair = dat[i];
        //hope to god this works
        GetTheCandles(dat[i], chartList.length - 1);
        
    }
}
function PairListFinished() {
    runningList = false;
    // set drawingstrat back to what it was instead of just true
    drawingStrat = true;
    // delete charts?
    pairListSize = 0;
    let highestVal = 0;
    let bestPair;
    console.log(pairListResults)
    for (let i = 0; i < pairListResults.length; i++) {
        if (pairListResults[i].finalValue > highestVal) {
            bestPair = pairListResults[i].pair;
            highestVal = pairListResults[i].finalValue;
        }

    }
    console.log(`Best asset was ${bestPair} with value of \$${highestVal}`);
    pairListResults = [];
}


function GetTheCandles(pa, chartNum) {
    /**
     * This function connects to the desired api to retrieve history, and formats it to make it universal.
     * TODO: find out how to plug in data
     */
    let chartInterval = chartList[chartNum].chartInterval;
    let intervalType = chartInterval.split(" ")[1];
    let intervalNum = parseInt(chartInterval.split(" ")[0]);
    var graph = {
        chartNumber: chartNum,
        element: document.getElementById('graph' + chartNum),
        topPadding: 10,
        botPadding: 40
    }

    if (intervalType == 'hours') {
        intervalNum *= 60;
        intervalType = 'minute';
    }
    if (tempStrat.token[0] == 'kraken') {
        
        console.log(intervalNum);
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
                'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                'user-agent': 'Node.js app'

            }
        })
        .then((response) => {
            res = response.data.result;
            console.log(response.data);
            chartList[chartNum].InitData('kraken', graph, Object.values(res)[0]);
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
                console.log(response.data);
                let res = response.data.candles;
                chartList[chartNum].InitData('td', graph, res);
            })
            .catch(error => {
                console.log(error);
                alert(error);
            })
        }
        getItMasteria()
    }

}

// couldnt keep this in chart class, idk why???
function UpdateCharts() {
    // update every chart when one is
    for (let i = 0; i < chartList.length; i++)
    {
        if (chartList[i].pair == '') continue;
        GetTheCandles(chartList[i].pair, i);
    }
}

/// exchange: string; the exchange name
/// graph: object for the graph this is connected to
/// there can be multiple charts
/// backtestData: all the data we pulled
class Chart {
    constructor(params = null/*exchange, graphdat, backtestData*/) {
        //TODO: make sure this works
        if (params && params.hasOwnProperty('chartInterval')) {
            this.chartInterval = params[chartInterval];
        } else {
            this.chartInterval = '30 minute';
        }
        // if we start buying or selling
        this.startWithBuy = true;
        // can't trade after hours
        this.noAfterHours = true;
        this.canvasWidth = 800;
        // boughtIndexes are indexes we placed a buy. right now only supports one item in list
        this.boughtIndexes = [];
        // starting cash
        this.startingCash = 1000;
        this.tradingStock = 0;
        this.parsedDat = [];
        this.chartIndex = chartList.length;
        
        // used for updating strat buy/sell lists to know what index we on in other fnctns
        this.stratIndex = 0;
        this.buyIndexList = [];
        chartList.push(this);

        // this gets called externally only now
        //this.InitData(exchange, graphdat, backtestData);
        if (drawingStrat)
            this.InitElements(params);

        
        this.myGraph = null;
    }
    InitElements(params) {
        let myIndex = chartList.length - 1;
        if (params == null) {
            /*
            tempStrat.charts.push({
                pair: ''
            });*/
            this.pair = '';
        } else {
            this.pair = tempStrat.charts[myIndex].pair;
        }
        //BRO USE CSS GRID FOR MAINCONTAIN
        //let maincontain = document.getElementById('chartStuff');
        this.maincontain = document.createElement('div');
        this.maincontain.id = 'chartStuff' + myIndex;
        /// Create Pair form
            //div autocomplete
                // input text
            //input submit
        // h1 show pair
    
        /// canvas
    
        /// div lowercontrols
            // dropdown period
        //sliders
    
        let pForm = document.createElement('form');
        pForm.autocomplete = 'off';
        pForm.id = 'pairForm' + myIndex;
    
        let aComp = document.createElement('div');
        aComp.className = 'autocomplete';
        let pSelect = document.createElement('input');
        pSelect.className = 'txtInput';
        pSelect.id = 'pairSelect' + myIndex;
        pSelect.type = 'text';
        pSelect.name = pSelect.id;
        pSelect.placeholder = 'Select Pair';
        if (params != null) {
            pSelect.value = params.pair;
        }
        aComp.appendChild(pSelect);
        pForm.appendChild(aComp);
    
        let pSubmit = document.createElement('input');
        pSubmit.type = 'submit';
        pSubmit.className = 'txtInput pairSubmit';
        pForm.appendChild(pSubmit);
        this.maincontain.appendChild(pForm);
    
        let showPear = document.createElement('h1');
        showPear.id = 'showPair' + myIndex;
        showPear.style.display = 'none';
        this.maincontain.appendChild(showPear);
    
        //canv
        // TODO: calculate width and height based on current myIndex
        let theCanvas = document.createElement('canvas');
        theCanvas.innerHTML = 'not loading';
        theCanvas.id = 'graph' + myIndex;
        theCanvas.className = 'graph';
        theCanvas.width = this.canvasWidth.toString();
        theCanvas.height = '400';
        this.maincontain.appendChild(theCanvas);
        
        let lowChartCont = document.createElement('div');
        lowChartCont.id = 'lowerChartControls' + myIndex;

        let iselectLabel = document.createElement('label');
        iselectLabel.for = 'intervalSelector' + myIndex;
        iselectLabel.innerHTML = 'Interval: ';
        let islect = this.InitIntervalSelector();
        islect.name = 'intervalSelector' + myIndex;
        islect.id = 'interSelector' + myIndex;

        lowChartCont.appendChild(iselectLabel);
        lowChartCont.appendChild(islect);
        this.maincontain.appendChild(lowChartCont);
    
        let sliderCntn = document.createElement('div');
        sliderCntn.id = 'sliderContainer' + myIndex;
        
        this.maincontain.appendChild(sliderCntn);
        document.getElementById('rightSide').appendChild(this.maincontain);

        this.chartInterval = islect.value;
    
        // Event Listeners
        pForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // TODO: td ameritrade; other api functionality
            let pair = pSelect.value;
            if (tempStrat.token[0] == 'kraken' && !krakenPairList.includes(pair.toUpperCase())) {
                alert('bitch sit down');
                return;
            }
            tempStrat.charts[myIndex].pair = pair;
            chartList[myIndex].pair = pair;
            ipcRenderer.send('currentStrat:updateFile', tempStrat);
            showPear.innerHTML = pair;
            pForm.style.display = 'none';
            showPear.style.display = 'block';
            pSelect.value = '';
            UpdateCharts();
    
        });
        showPear.addEventListener('click', function(e) {
            pSelect.value = showPear.innerHTML;
            showPear.style.display = 'none';
            pForm.style.display = 'block';
            pSelect.select();
            showPear.innerHTML = '';
        });
        islect.addEventListener('change', function(e) {
            e.preventDefault();
            chartList[myIndex].chartInterval = islect.value;
            UpdateCharts();
        });
    
        // Other
        styling.autocomplete(pSelect, krakenPairList);

    }
    InitIntervalSelector() {
        let islect = document.createElement('select');
        let optn = document.createElement('option');
        optn.value = '5 minute';
        optn.innerHTML = '5 min';
        islect.appendChild(optn);
        optn = document.createElement('option');
        optn.value = '30 minute';
        optn.innerHTML = '30 min';
        islect.appendChild(optn);
        optn = document.createElement('option');
        optn.value = '1 hour';
        optn.innerHTML = '1 hour';
        islect.appendChild(optn);
        optn = document.createElement('option');
        optn.value = '6 hour';
        optn.innerHTML = '6 hour';
        islect.appendChild(optn);
        
        islect.value = '30 minute';
        return islect;
    }

    /// We call this when new data is loaded
    InitData(exchange, graphdat, backtestData) {
        // 'kraken', etc
        this.apiType = exchange;
        this.graphDat = graphdat;
        // this is what the list will look like
        [{'timestamp':5854239, 'open': "0.004", 'etc': 'ya'}]
        this.parsedDat = [];
        //add color data here
        this.upperChartIndicatorData = [];

        /// goes thru each candlestick and
        /// turns it into readable data.
        /// this method will be used for each
        /// exchange, and the resulting data
        /// will be in the same format across
        /// each one.
        if (this.apiType == 'kraken')
        {
            this.noAfterHours = false;
            for (let p = 0; p < backtestData.length; p++)
            {
                // change this later if need be
                var cStick = {
                    'timestamp': backtestData[p][0],
                    'open': parseFloat(backtestData[p][1]),
                    'high':parseFloat(backtestData[p][2]),
                    'low':parseFloat(backtestData[p][3]),
                    'close':parseFloat(backtestData[p][4]),
                    'volume':parseFloat(backtestData[p][6]),
                    'trades':parseFloat(backtestData[p][7])
                };
                this.parsedDat.push(cStick);
            }
        }
        if (this.apiType == 'td') {
            for (let candle = 0; candle < backtestData.length; candle++)
            {
                let dat = backtestData[candle];
                // change this later if need be
                // TODO: make sure timestamps are in same units!!
                var cStick = {
                    'timestamp': dat.datetime / 1000,
                    'open': dat.open,
                    'high': dat.high,
                    'low': dat.low,
                    'close': dat.close,
                    'volume': dat.volume,
                    'trades': null
                };
                this.parsedDat.push(cStick);
            }
        }//else if apitype....

        // TODO: maybe in the future allow the zoom to be bigger than dataset
        let zom = 25;
        if (this.parsedDat.length <= zom) {
            zom = this.parsedDat.length - 1;
        }

        this.MegaLoop();

        //why is lastIndex even a thing?? fuckin banish that shit
        // TODO: use timestamp to determine position based from last
        
        this.dynChartWindowData = {
            // how many indexes can we fit
            // TODO: change to a zoom scale so we can fit half csticks on edge
            zoom:zom,
            shift:0,
            lastIndex:this.parsedDat.length - 1
        };


        if (tempStrat.indicators.length > 0) {
            this.UpdateIndicatorDat();
        }
        this.UpdateStratDat();
        
        
        // this will happen twice if updateindicatordat is called, oh well
        if (this.myGraph && drawingStrat) {
            this.myGraph.CalibrateSliders();
            this.myGraph.DrawChart();
        } else {
            if (drawingStrat)
                this.myGraph = new Graph(this);
        }
        // if we're last in the list (if we are running through one), finish it up.
        // had to take this out of updatestratdat bc it will update drawingstrat var, etc
        // has to be at end of code
        if (runningList) {
            if (pairListSize == pairListResults.length) {
                // we finished list of pairs
                console.log('finished,',pairListSize);
                PairListFinished();
            }
        }
    }
    MegaLoop() {
        /**
         * This loop is called anytime we get new parsedData generated.
         * It adds any bells and whistle data for the chart 
         */
        let newDays = [];
        let lastTimestamp = 0;
        let lastDate;
        let curDate;

        //pre post market
        let afterHoursDat = [];
        let dayt;
        let intervalType = this.chartInterval.split(" ")[1];
        let intervalNum = parseInt(this.chartInterval.split(" ")[0]);
        let timeOfDay;
        switch (intervalType) {
            case 'minute':
                this.secondsPerCandle = 60 * intervalNum;
                break;
            case 'hour':
                this.secondsPerCandle = 3600 * intervalNum;
                break;
        }
        let timeInSecs;
        for (let item = 0; item < this.parsedDat.length; item++) {
            // First we calculate new days.
            if (lastTimestamp == 0) {
                lastTimestamp = this.parsedDat[item].timestamp;
                newDays.push(false);
            }
            else {
                lastDate = new Date(lastTimestamp * 1000);
                curDate = new Date(this.parsedDat[item].timestamp * 1000);
                // date.getDate() gives the day https://stackoverflow.com/questions/10535782/how-can-i-convert-a-date-in-epoch-to-y-m-d-his-in-javascript
                // TODO: intervals >= 1 day will have a dateline for every candle lmao
                if (lastDate.getDate() != curDate.getDate()) {
                    // new day. Draw line before current candle
                    newDays.push(true);
                }
                else {
                    newDays.push(false);
                }
                lastTimestamp = this.parsedDat[item].timestamp;
            }


            // pre and post market data
            if (this.chartInterval.includes('minute') || this.chartInterval.includes('hour')) {
                /*
                    1 hr = 3600 sec
                    idk what this will do on holidays and unusual opening/closing times
                */
               
                dayt = new Date(this.parsedDat[item].timestamp * 1000);
                let timeStringList = dayt.toLocaleString('en-US', {timeZone: 'America/New_York'}).split(", ")[1].split(" ");
                
                timeInSecs = parseInt(timeStringList[0][0]) * 60 * 60;
                timeInSecs += parseInt(timeStringList[0].split(':')[1]) * 60;
                // if the date ends on or after market opens, add data
                // if the date ends on or after market closes, add data
                // data is ['pre', dataforwhentostart]
                // or ['post', dataforwhentoend]
                //premarket
                // 9:30 in secs is 34200
                if (timeStringList[1] == 'AM' && (timeInSecs == 34200 || timeInSecs < 34200 && timeInSecs + this.secondsPerCandle > 34200)) {
                    afterHoursDat.push(['pre', 34200 - timeInSecs]);
                    timeOfDay = 'during';
                }
                // 4:00 in secs 14400
                else if (timeStringList[1] == 'PM' && (timeInSecs == 14400 || timeInSecs < 14400 && timeInSecs + this.secondsPerCandle > 14400)) {
                    afterHoursDat.push(['post', 14400 - timeInSecs]);
                    timeOfDay = 'after';
                }
                else if (item == 0) {
                    // if we're in first one, check if in daytime or afterhours
                    if (timeStringList[1] == 'AM' && timeInSecs < 34200 || timeStringList[1] == 'PM' && timeInSecs > 14400) {
                        timeOfDay = 'after';
                    }
                    else {
                        timeOfDay = 'during';
                    }
                    afterHoursDat.push(timeOfDay);
                }
                else {
                    afterHoursDat.push(timeOfDay);
                }

            }

        }
        console.log(afterHoursDat);

        // Apply the data
        this.upperChartMiscData = {
            dateLines: newDays,
            afterHours: afterHoursDat
        };

    }
    // ohlc determines whether we compare opens, highs, lows, closes
    EvalObj(obj) {
        let x;
        if (obj.hasOwnProperty('logic'))
            x = EvalBools(this.EvalObj(obj.firstExpression), this.EvalObj(obj.secondExpression), obj.logic);
        else {
            //TODO: test this.
            //if one of the indicators hasn't been calculated accurately yet, return false.
            // by this i mean if like you have price from 2 indexes ago but we're on the first
            // one, we literally can't do anything
            if (obj.first.params.hasOwnProperty('index') && obj.first.params.index > this.stratIndex) return false;
            if (obj.second.params.hasOwnProperty('index') && obj.second.params.index > this.stratIndex) return false;

            let firstval = this.GetVarValue(obj.first);
            let secondval = this.GetVarValue(obj.second);

            // math var has index out of range
            if (firstval == 'no' || secondval == 'no') return false;

            x = EvalVars(firstval, secondval, obj.compareOp);
        }
        if (obj.notted)
            x = !x;
        return x;
    }
    GetVarValue(obj) {
        /**
         * housekeeping
         */
        switch (obj.type) {
            case 'math':
                return this.EvalMathObject(obj.params.mathObject);
            case 'constant':
                return obj.params.value;
            case 'price':
                return this.parsedDat[this.stratIndex - obj.params.index][obj.params.ohlc];
            case 'buy-price':
                if (this.boughtIndexes.length == 0) return 'no';
                // TODO: should we just keep the close here?
                return this.parsedDat[this.boughtIndexes[obj.params.buyIndex]].close;
            case 'time-of-day':
                // returns minutes since day started
                let tim = new Date(this.parsedDat[this.stratIndex].timestamp * 1000);
                tim = tim.toLocaleString('en-US', {timeZone: 'America/New_York'}).split(", ")[1].split(" ");
                let clocktime = tim[0].split(':');
                if (clocktime[0] == '12')
                    clocktime[0] = '0';
                let timeInMins = parseInt(clocktime[0]) * 60 + parseInt(clocktime[1]);
                if (tim[1] == 'PM')
                    timeInMins += 12 * 60;
                if (obj.params.units == 'hours')
                    timeInMins /= 60;
                return timeInMins;

        }

    }
    EvalMathObject(obj) {
        let x;
        // if it hasownproperty params, we in final obj and return 
        if (obj.hasOwnProperty('operator')) {
            return EvalMath(this.EvalMathObject(obj.firstOperand), this.EvalMathObject(obj.secondOperand), obj.operator);
        }
        else {
            // tell other functions we out of range
            if (obj.params.hasOwnProperty('index') && obj.params.index > this.stratIndex) return 'no';
            // basically copy evalobj
            return this.GetVarValue(obj);
        }
    }

    UpdateStratDat() {
        /**
         * Whenever strategy or chart is modified I think this is called.
         * Recalculates buy data for chart (list for when a buy has happened),
         * then redraws chart.
         * returns optional data (for list testing)
         */
        if (this.startWithBuy) {
            this.tradingCash = this.startingCash;
            this.tradingStock = 0;
            // this will be fun to figure out if startwithbuy==false
            this.boughtIndexes = [];
        }

        let calcbuy = tempStrat.buyStratBP.length > 0;
        let calcsell = tempStrat.sellStratBP.length > 0;
        // Parse math blueprints first
        AddMathObjects();
        console.log('buystratbp:', tempStrat.buyStratBP);
        console.log('sellstratbp:', tempStrat.sellStratBP);

        this.buyIndexList = [];
        this.sellIndexList = [];
        // parse blueprint here and when a var change is submitted
        buyStratComparisons = ParseStratBlueprint(tempStrat.buyStratBP);
        sellStratComparisons = ParseStratBlueprint(tempStrat.sellStratBP);

        console.log('buystratcomp');
        console.log(buyStratComparisons);

        if (calcbuy || calcsell) {
            let buying = this.startWithBuy;
            let valToAdd;
            for (this.stratIndex = 0; this.stratIndex < this.parsedDat.length; this.stratIndex++) {
                // if we can't trade outside market hours, check if we are in or outside market hours
                if (this.noAfterHours) {
                    //TODO: make sure it will still calculate data inside after hours
                    // the second part of this OR is if starting time is less than 5 minutes within market close/start
                    // TODO: change open to last part of candle instead of beginning - try buying at 9:30 and selling at 4, buy is messed up
                    if (this.upperChartMiscData.afterHours[this.stratIndex] != 'after') {
                        console.log(this.upperChartMiscData.afterHours[this.stratIndex]);
                    }
                    // if it's after market, or if it's ending on the candle and time is < 5 minutes that's after, if more we can buy on open. (or just skip)
                    // or if it's pre market, if time is 0 we good but if it's longer we can buy the close (in other words skip)
                    // SCRATCH THAT ABOVE, if candle is in between afterhours it's fucked
                    if (this.upperChartMiscData.afterHours[this.stratIndex] == 'after' || Array.isArray(this.upperChartMiscData.afterHours[this.stratIndex]) && !(this.upperChartMiscData.afterHours[this.stratIndex][0] == 'pre' && this.upperChartMiscData.afterHours[this.stratIndex][1] < 1)) {// this.upperChartMiscData.afterHours[this.stratIndex][0] == 'post' && this.upperChartMiscData.afterHours[this.stratIndex][1] < 5) {
                        if (calcbuy)
                            this.buyIndexList.push(false);
                        if (calcsell)
                            this.sellIndexList.push(false);
                        continue;
                    }
                    else if (Array.isArray(this.upperChartMiscData.afterHours[this.stratIndex])) {
                        // TODO: calculate avg number or something?
                        // also shit would depend on if ur using close or open or high or low on price
                        // for now i'm just gonna let it use candle regularly

                    }
                }
                if (calcbuy) {
                    valToAdd = buying && this.EvalObj(buyStratComparisons);
                    this.buyIndexList.push(valToAdd);
                    // we cant b allowed to sell and buy on the same index
                    if (valToAdd) {
                        console.log('buyin', this.tradingCash);
                        this.boughtIndexes.push(this.stratIndex);
                        buying = false;
                        if (calcsell)
                            this.sellIndexList.push(false);
                        this.OnBuyOrSell(true);
                        continue;
                    }
                }
                if (calcsell) {
                    valToAdd = !buying && this.EvalObj(sellStratComparisons);
                    this.sellIndexList.push(valToAdd);
                    if (valToAdd) {
                        this.boughtIndexes = [];
                        buying = true;
                        this.OnBuyOrSell(false);
                    }
                }
            }
            this.stratResults = {
                pair: this.pair,
                finalValue: this.tradingCash + this.tradingStock * this.parsedDat[this.parsedDat.length - 1].close
            };
            if (runningList) {
                pairListResults.push(this.stratResults);
            }
            console.log('Ending money:', this.tradingCash);
            console.log('Ending stock:', this.tradingStock);
        }

        // Update graphics
        if (this.myGraph && drawingStrat) 
            this.myGraph.DrawChart();
    }
    OnBuyOrSell(buy, percentageToUse=1) {
        // TODO: am i calculating this right? should we buy on next candle or what?
        // also resetting values to 0 is not accurate at ALL bro
        // look at ur old trading project to calculate accurately
        // if you change close here, change it in getvarvalue buy-price
        let stockPrice = this.parsedDat[this.stratIndex].close;
        switch (tempStrat.token[0]) {
            case 'kraken':
                if (buy) {
                    this.tradingStock += this.tradingCash * percentageToUse / stockPrice;
                    this.tradingCash -= this.tradingCash * percentageToUse;
                }
                else {
                    this.tradingCash += this.tradingStock * stockPrice;
                    this.tradingStock = 0;
                }
                break;
            default:
                if (buy) {
                    if (this.tradingCash * percentageToUse < this.tradingStock) {
                        // TODO: add margin trading capabilities
                        console.log('NOT ENOUGH FUNDS');
                        return;
                    }
                    let stockQuant = Math.floor(this.tradingCash * percentageToUse / stockPrice);
                    this.tradingStock += stockQuant;
                    this.tradingCash -= stockQuant * stockPrice;
                    console.log('tradingStock:',this.tradingStock);
                    if (this.tradingCash < 0) alert('tradingCash negative', this.tradingCash, 'index', this.stratIndex);
                }
                else {
                    this.tradingCash += this.tradingStock * stockPrice;
                    this.tradingStock = 0;
                    console.log('tradingCash:',this.tradingCash);
                }
                break;
        }
    }

    // Optional param: if you supply the index it will do that one instead of all of them
    /// TODO: add lowerchartindicatordata
    UpdateIndicatorDat(indx = null, removing = false) {
        if (indx != null) {
            if (removing) {
                this.upperChartIndicatorData.splice(indx, 1);
            } else {
                this.UIDStuff(indx);
            }
        } else {
            for (let indi = 0; indi < tempStrat.indicators.length; indi++) {
                this.UIDStuff(indi);
            }
        }
        // if myGraph is already drawn, we need to update it
        if (this.myGraph && drawingStrat) {
            this.myGraph.DrawChart();
        }
    }
    UIDStuff(index) {
        /**
         * Iterates through parsed data, calculating indicator values
         */
        let finishedList = [];
        switch (tempStrat.indicators[index].type) {
            case 'MA':
                let tempDatList = [];
                let periodList = [];
                for (let p = 0; p < this.parsedDat.length; p++) {
                    // TODO: if you want to edit whether it uses open v close etc add here
                    periodList.push(this.parsedDat[p].close);
                    if (periodList.length == tempStrat.indicators[index].params.period) {
                        tempDatList.push(periodList.reduce((a, b) => a + b, 0) / periodList.length);
                        // remove first item
                        periodList.shift();
                    } else {
                        tempDatList.push(null);
                    }
                }
                finishedList = tempDatList;

                break;
            default:
                break;
        }
        // i think index will always be included or one after the last in upperchartinddat
        this.upperChartIndicatorData[index] = finishedList;
    }
    /// from current viewable sticks
    // TODO: include upperchartindicator values in high and low
    GetHighAndLow() {
        let firstInd = this.dynChartWindowData.lastIndex - this.dynChartWindowData.zoom;
        let h = this.parsedDat[firstInd].high;
        let l = this.parsedDat[firstInd].low;
        let curHigh = 0;
        let curLow = 0;
        for (var i = firstInd; i <= this.dynChartWindowData.lastIndex; i++) {
            curHigh = this.parsedDat[i].high;
            curLow = this.parsedDat[i].low;
            if (curHigh > h) h = curHigh;
            if (curLow < l) l = curLow;
        }
        return [h, l];
    }
    Delete() {
        this.RemoveHTML();
        // remove from list, trigger index change

    }
    RemoveHTML() {
        this.maincontain.remove();
    }
}

class Graph {
    constructor(linktChart) {
        //linktChart is a chart class instance
        this.linkedChart = linktChart;
        this.canv = this.linkedChart.graphDat.element;
        this.graphDat = this.linkedChart.graphDat;
        //this.dynWinDat = this.linkedChart.dynChartWindowData;
        this.options = {
            prices: true
        }

        if (drawingStrat)
            this.DrawChart();
        

        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.className = "slider";
        document.getElementById("sliderContainer" + this.graphDat.chartNumber).appendChild(this.slider);


        this.scroller = document.createElement('input');
        this.scroller.type = 'range';
        this.scroller.className = "slider";
        document.getElementById("sliderContainer" + this.graphDat.chartNumber).appendChild(this.scroller);

        this.CalibrateSliders();

        this.slider.oninput = function() {
            //let cnum = chartList.indexOf(linktChart);
            if (this.value != linktChart.dynChartWindowData.zoom && drawingStrat) {
                linktChart.dynChartWindowData.zoom = this.value;
                var firstind = linktChart.dynChartWindowData.lastIndex - linktChart.dynChartWindowData.zoom;
                if (firstind < 0)
                {
                    linktChart.dynChartWindowData.lastIndex -= firstind;
                } else {
                    linktChart.myGraph.scroller.max = 0;
                }
                linktChart.myGraph.scroller.min = 0 - (linktChart.parsedDat.length - 1 - linktChart.dynChartWindowData.zoom);
                linktChart.myGraph.DrawChart();
            }
        }

        this.scroller.oninput = function() {
            if (Math.round(this.value) == linktChart.dynChartWindowData.shift || !drawingStrat) return;
            linktChart.dynChartWindowData.shift = Math.round(this.value);
            linktChart.dynChartWindowData.lastIndex = linktChart.parsedDat.length - 1 + Math.round(this.value);
            linktChart.myGraph.DrawChart();
        }
    }
    CalibrateSliders() {
        /**
         * 
         */
        //first zoom slider

        this.slider.min = 0;
        this.slider.max = this.linkedChart.parsedDat.length - 1;
        console.log('data length:' + this.linkedChart.parsedDat.length - 1)
        this.slider.value = this.linkedChart.dynChartWindowData.zoom;
        // then scroller
        this.scroller.min = 0 - (this.linkedChart.dynChartWindowData.lastIndex - this.linkedChart.dynChartWindowData.zoom);
        this.scroller.max = 0;
        this.scroller.value = 0;

    }
    ComputeWidth() {
        this.availableWidth = this.canv.width;
        this.startingXPos = 0;
        this.endingXPadding = 0;
        if (this.options.prices) {
            this.endingXPadding += 60;
        }
        this.availableWidth -= (this.startingXPos + this.endingXPadding);
    }
    DrawChart() {
        var firstInd = this.linkedChart.dynChartWindowData.lastIndex - this.linkedChart.dynChartWindowData.zoom;
        var hl = this.linkedChart.GetHighAndLow();
        this.high = hl[0];
        this.low = hl[1];

        var availableSpace = this.canv.height - (this.graphDat.botPadding + this.graphDat.topPadding);
        this.scale = availableSpace / (this.high - this.low);
        // TODO: possible optimization: only call computewidth when needed
        this.ComputeWidth();
        this.indexlength = this.linkedChart.dynChartWindowData.lastIndex - firstInd + 1;
        this.xscale = this.availableWidth / this.indexlength;
        this.indexCount = 0;


        if (this.canv.getContext) {
            this.ctx = this.canv.getContext('2d');
        }
        this.ctx.clearRect(0, 0, this.canv.width, this.canv.height);
        this.DrawGridLines();

        // Draw DateLines and pre/post market
        // afterhrstodraw has lists [start, end]
        let afterHoursStart = 'blank';
        // if we haven't drawn any afterhours, check to see if whole screen should be dark
        let haventDrawnAny = true;
        for (var j = firstInd; j <= this.linkedChart.dynChartWindowData.lastIndex; j++) {
            if (Array.isArray(this.linkedChart.upperChartMiscData.afterHours[j])) {
                //see if it's in pre or post
                // if it's pre, we end the line
                if (this.linkedChart.upperChartMiscData.afterHours[j][0] == 'pre') {
                    this.DrawPrePostMarket(afterHoursStart, (this.indexCount * this.xscale + this.linkedChart.upperChartMiscData.afterHours[j][1] * this.availableWidth / (this.indexlength * this.linkedChart.secondsPerCandle) + this.startingXPos) - afterHoursStart);
                    afterHoursStart = 'blank';
                    haventDrawnAny = false;
                }
                else {
                    afterHoursStart = this.indexCount * this.xscale + this.linkedChart.upperChartMiscData.afterHours[j][1] * this.availableWidth / (this.indexlength * this.linkedChart.secondsPerCandle) + this.startingXPos;
                }

            }
            else if (j == firstInd && this.linkedChart.upperChartMiscData.afterHours[firstInd] == 'after') {
                afterHoursStart = this.startingXPos;
            }
            // check if we hit the end. check if afterhours start has a value, if not check if whole screen should be gray
            if (j == this.linkedChart.dynChartWindowData.lastIndex) {
                if (afterHoursStart != 'blank') {
                    this.DrawPrePostMarket(afterHoursStart, this.availableWidth + this.startingXPos);
                    afterHoursStart = 'blank';
                }
                else if (haventDrawnAny) {
                    // check to see if ANY candle is in afterhours, if so whole screen is
                    if (this.linkedChart.upperChartMiscData.afterHours[j] == 'after') {
                        this.DrawPrePostMarket(this.startingXPos, this.startingXPos + this.availableWidth);
                    }
                }
            }
            if (this.linkedChart.upperChartMiscData.dateLines[j]) {
                this.DrawDateLine(j);
            }
            this.indexCount += 1;
        }
        this.indexCount = 0;

        

        // Draw candlesticks
        for (var j = firstInd; j <= this.linkedChart.dynChartWindowData.lastIndex; j++) {
            this.DrawCandlestick(j);
            this.indexCount += 1;
        }
        this.indexCount = 0;

        // Draw indicators
        for (let n = 0; n < this.linkedChart.upperChartIndicatorData.length; n++) {
            // Set color
            this.ctx.strokeStyle = tempStrat.indicators[n].params.color;
            for (var j = firstInd; j <= this.linkedChart.dynChartWindowData.lastIndex; j++) {
                this.DrawUpperIndicatorLine(n, j);
                this.indexCount += 1;
                // If there is a value past the chart, we can draw the last line to it
                if (j == this.linkedChart.dynChartWindowData.lastIndex && j < this.linkedChart.upperChartIndicatorData[n].length - 1) {
                    this.DrawUpperIndicatorLine(n, j + 1);
                }
            }
            this.indexCount = 0;
        }
        // TODO: make draw buy and sell run faster - both at same time etc
        // Draw Buy
        if (this.linkedChart.buyIndexList.length > 0) {
            for (var j = firstInd; j <= this.linkedChart.dynChartWindowData.lastIndex; j++) {

                if (this.linkedChart.buyIndexList[j]) {
                    this.DrawBuySellAction(j, true, 'close');
                }
                this.indexCount += 1;
            }
            this.indexCount = 0;
        }
        if (this.linkedChart.sellIndexList.length > 0) {
            for (let j = firstInd; j <= this.linkedChart.dynChartWindowData.lastIndex; j++) {
                if (this.linkedChart.sellIndexList[j]) {
                    this.DrawBuySellAction(j, false, 'close');
                }
                this.indexCount += 1;
            }
            this.indexCount = 0;
        }

        this.DrawGridLineData();

    }
    DrawGridLines() {
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        let inc = Math.floor((this.high - this.low) / 5);
        if (inc >= 1) {
            let numbString = inc.toString();
            let newString = numbString[0];

            for (var i = 1; i < numbString.length; i++)
            {
                newString += '0';
            }
            let increment = parseInt(newString);
            let hConstraint = Math.floor(this.high / increment) * increment;
            let lConstraint = Math.ceil(this.low / increment) * increment;
            this.gridLineDat = [];
            for (var i = lConstraint; i <= hConstraint; i += increment) {
                this.gridLineDat.push(i);
                this.ctx.beginPath();
                this.ctx.moveTo(this.startingXPos, (this.high - i) * this.scale);
                this.ctx.lineTo(this.startingXPos + this.availableWidth, (this.high - i) * this.scale);
                this.ctx.stroke();
            }
        } else {
            let increment = (this.high - this.low) / 5;
            //console.log(increment.toFixed.toString());
            let numbString = increment.toFixed(20).toString();
            let newString = '';
            let hitFirstDig = false;
            let zeroesBeforeNumb = 0;
            // start i at first numb after decimal
            for (var i = 2; i < numbString.length; i++) {
                if (numbString[i] != '0') {
                    hitFirstDig = true;
                }
                if (!hitFirstDig) {
                    zeroesBeforeNumb += 1;
                    continue;
                }
                newString = '0.';
                for (var j = 0; j < zeroesBeforeNumb; j++) {
                    newString += '0';
                }
                newString += numbString[i];
                break;
            }
            //console.log('newstring: ' + parseFloat(newString));
            //console.log(Math.round(this.low / parseFloat(newString)) * parseFloat(newString));
            var j = 0;
            while (j < this.low) {
                j += parseFloat(newString);
            }
            // lconstraint
            let lconstString = '';
            let lw = this.low.toString();
            let hitDec = false;
            let countAfterDec = 0;
            for (var i = 0; i < lw.length; i++) {
                if (hitDec) {
                    countAfterDec += 1;
                }
                if (countAfterDec > zeroesBeforeNumb) {
                    lconstString += Math.round(parseFloat(lw[i] + '.' + lw[i + 1])).toString();
                    break;
                } else {
                    lconstString += lw[i];
                }

                if (lw[i] == '.') {
                    hitDec = true;
                }
            }
            //console.log(this.low);
            //console.log('lconst ' + parseFloat(lconstString));


            increment = parseFloat(newString);
            let hConstraint = Math.round(this.high / parseFloat(newString)) * parseFloat(newString);
            let lConstraint = parseFloat(lconstString);
            //console.log(hConstraint);
            //console.log(lConstraint);
            this.gridLineDat = [];
            for (var i = lConstraint; i <= hConstraint; i += increment) {
                this.gridLineDat.push(i);
                this.ctx.beginPath();
                this.ctx.moveTo(this.startingXPos, (this.high - i) * this.scale);
                this.ctx.lineTo(this.startingXPos + this.availableWidth, (this.high - i) * this.scale);
                this.ctx.stroke();
            }
        }

    }
    DrawGridLineData() {
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(this.canv.width - this.endingXPadding, 0, this.endingXPadding, this.canv.height);
        // now the text
        this.ctx.fillStyle = 'black';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '12px arial';
        for (let v = 0; v < this.gridLineDat.length; v++) {
            this.ctx.fillText(this.gridLineDat[v], this.canv.width - this.endingXPadding, (this.high - this.gridLineDat[v]) * this.scale);
        }
    }
    
    DrawCandlestick(ind) {
        var ohlc = this.linkedChart.parsedDat[ind];
        var green = ohlc.open <= ohlc.close;
        let firstX = this.indexCount * this.xscale + this.startingXPos;
        if (ohlc.open == ohlc.close) {
            this.ctx.fillStyle = 'rgb(0, 255, 0)';
            this.ctx.beginPath();
            this.ctx.moveTo(firstX, (this.high - ohlc.close) * this.scale);
            this.ctx.lineTo((this.indexCount + 1) * this.xscale + this.startingXPos, (this.high - ohlc.close) * this.scale);
            this.ctx.stroke();
        } else if (green) {
            this.ctx.fillStyle = 'rgb(0, 255, 0)';
            this.ctx.fillRect(firstX, (this.high - ohlc.close) * this.scale + this.graphDat.topPadding, this.xscale, (ohlc.close - ohlc.open) * this.scale);
        } else {
            this.ctx.fillStyle = 'rgb(255, 0, 0)';
            this.ctx.fillRect(firstX, (this.high - ohlc.open) * this.scale + this.graphDat.topPadding, this.xscale, (ohlc.open - ohlc.close) * this.scale);
        }
        // High Low
        var lineWidth = this.xscale / 8;
        this.ctx.fillRect(firstX + this.xscale / 2 - lineWidth / 2, (this.high - ohlc.high) * this.scale + this.graphDat.topPadding, lineWidth, (ohlc.high - ohlc.low) * this.scale); 

    }
    DrawDateLine(bigIndex) {
        /**
         * Draw vertical line where there's a new day. If it's the leftmost candle, skip.
         */
        if (this.indexCount == 0) return;
        this.ctx.strokeStyle = 'rgb(100, 100, 100)';
        let xpos = this.indexCount * this.xscale + this.startingXPos;
        this.ctx.beginPath();
        this.ctx.moveTo(xpos, 0);
        this.ctx.lineTo(xpos, this.canv.height - this.graphDat.botPadding);
        this.ctx.stroke();
        let date = new Date(this.linkedChart.parsedDat[bigIndex].timestamp * 1000);
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let year = date.getFullYear();
        let dateString = month + '/' + day + '/' + year;
        this.ctx.fillStyle = 'blue';
        this.ctx.textAlign = 'center';
        this.ctx.font = '12px arial';
        this.ctx.fillText(dateString, xpos, this.canv.height - this.graphDat.botPadding / 2);
    }
    DrawPrePostMarket(startPos, endPos) {
        // called on every candle because apparently there are fucking random skips
        // in the stock market like 4:30am to 5am and shit
        this.ctx.fillStyle = 'rgba(200, 200, 220, .3)';
        this.ctx.fillRect(startPos, 0, endPos, this.canv.height);
        return;

        
        console.log('bigind:',bigIndex)
        let startingTime = new Date(this.linkedChart.parsedDat[bigIndex].timestamp * 1000);
        let timeStringList = startingTime.toLocaleString('en-US', {timeZone: 'America/New_York'}).split(", ")[1].split(" ");
        // DOING PREMARKET
        if (!('9:30' > timeStringList[0] && timeStringList[1] == 'AM') || timeStringList[0].split(':')[0].length > 1) return; // it's not premarket
        // convert candle time to minutes
        // since it's am, hour is first digit
        let timeInSecs = parseInt(timeStringList[0][0]) * 60 * 60;
        // now minutes
        timeInSecs += parseInt(timeStringList[0].split(':')[1]) * 60;
        // 9:30 in minutes is 570
        // 9:30 in secs is 34200
        console.log(timeStringList)

            
        let intervalType = this.linkedChart.chartInterval.split(" ")[1];
        let intervalNum = parseInt(this.linkedChart.chartInterval.split(" ")[0]);
        let pmarkwidth;
        // first check if candle ends out of premarket
        if (timeInSecs + this.linkedChart.secondsPerCandle > 34200) {
            let timeToDrawInSecs = 34200 - timeInSecs;
            console.log(timeToDrawInSecs / 60)
            pmarkwidth = timeToDrawInSecs * this.availableWidth / (this.indexlength * this.linkedChart.secondsPerCandle);

        }
        else {
            pmarkwidth = this.xscale;
        }
        //drawing pre
        let startingxpos = this.indexCount * this.xscale + this.startingXPos;
        // 19800 is seconds for premarket - 5.5 hrs

        // so it was either use .toLocaleString(), use moment timezone library, or do my own math
        // to get the timezone converted correctly. I chose tolocalestring

        //TODO: now delete this.canvwidth from chart class
        

        //this.linkedChart.dynChartWindowData.zoom/

    }
    DrawUpperIndicatorLine(indicatorIndex, ind) {
        //skip if it's the first one
        if (ind == 0 || this.linkedChart.upperChartIndicatorData[indicatorIndex][ind - 1] == null) return;
        let val = this.linkedChart.upperChartIndicatorData[indicatorIndex][ind];
        let prev = this.linkedChart.upperChartIndicatorData[indicatorIndex][ind - 1];
        this.ctx.beginPath();
        this.ctx.moveTo((this.indexCount - 1) * this.xscale + this.xscale / 2 + this.startingXPos, (this.high - prev) * this.scale + this.graphDat.topPadding);
        this.ctx.lineTo(this.indexCount * this.xscale + this.xscale / 2 + this.startingXPos, (this.high - val) * this.scale + this.graphDat.topPadding);
        this.ctx.stroke();
    }

    DrawBuySellAction(ind, buy, ohlc) {
        if (buy)
            this.ctx.fillStyle = 'rgba(5, 150, 5, .6)';
        else
            this.ctx.fillStyle = 'rgba(150, 5, 5, .6)';
        this.ctx.beginPath();
        let dat = this.linkedChart.parsedDat[ind];
        let xval = this.indexCount * this.xscale + this.startingXPos + this.xscale / 2;
        // TODO: make yval be where it actually should
        let yval = (this.high - dat[ohlc]) * this.scale + this.graphDat.topPadding;
        this.ctx.arc(xval, yval, this.xscale / 3, 0, Math.PI * 2, true);
        this.ctx.fill();

    }
}







// #############################################################################################

CreateAChart();
CreateAChart();
function CreateAChart(params = null) {
    let c = new Chart(params);
}
function DeleteChart(n) {
    // delete html
    // delete chartlist spot

    // only stuff at & after deletion in list
    // rename ids of chart elements
    // update event listeners
}



function IndicatorDropdown() {
    document.getElementById("indicatorSelect").style.display = "block";
}
window.onclick = function(event) {
    if (event.target.className != 'coolButt') {
        var dropdowns = document.getElementsByClassName('dropdown-content');
        var i;
        for (i = 0; i < dropdowns.length; i++) {
            var openDrop = dropdowns[i];
            if (openDrop.style.display == "block") {
                openDrop.style.display = "none";
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////
/////###############################Strat Design###############################/////
////////////////////////////////////////////////////////////////////////////////////

function UpdateStratFileAndGraph(loading=false) {
    /**
     * If we loading a strat we wont update tempstrat
     */
    if (!loading)
        ipcRenderer.send('currentStrat:updateFile', tempStrat);
    for (let i = 0; i < chartList.length; i++) {
        if (chartList[i].parsedDat.length == 0) continue;
        chartList[i].UpdateStratDat();
    }
}

function VariableDropdown(buy) {
    /**
     * Clicking on the plus to add another comparison
     */
    // IF NO STRAT YET ADD COMPARISON WITHOUT AND OR OR
    if (tempStrat.buyStratBP.length == 0 && buy) {
        AddBuyComparison();
        return;
    }
    if (tempStrat.sellStratBP.length == 0 && !buy) {
        AddSellComparison();
        return;
    }
    let idString;
    if (buy) {
        idString = 'buyVariableSelect';
    }
    else {
        idString = 'sellVariableSelect';
    }
    document.getElementById(idString).style.display = "block";
}

// deal with creating logical operators in parent function createlogicaloperatordiv
// returns newly created object, or object that was passed in
function AddBuyComparison(logicop=null, obj=null, loading=false) {
    if (logicop != null)
        AddBuyLogicOp(logicop);
    
    AddComparison(obj, true, loading);
}
function AddBuyLogicOp(o) {
    document.getElementById('buyStratBox').appendChild(CreateLogicalOperatorDiv(o, tempStrat.buyStratBP.length));
    tempStrat.buyStratBP.push(o);
}
function AddSellComparison(logicop=null, obj=null, loading=false) {
    // TODO: check if blueprint length is empty, then skip
    if (logicop != null) {
        AddSellLogicOp(logicop);
    }
    AddComparison(obj, false, loading);
}
function AddSellLogicOp(o) {
    document.getElementById('sellStratBox').appendChild(CreateLogicalOperatorDiv(o, tempStrat.sellStratBP.length, false));
    tempStrat.sellStratBP.push(o);
}

function AddComparison(obj, buy, loading) {
    /**
     * Creates needed variables and divs/elements to add a new comparison in 
     * buy or sell strategy.
     * if we loading in a strat, don't update tempstrat file
     */
    // id equals the div/object's position in stratblueprint list
    let id;
    let stratBoxName;
    let varDropdownName;
    if (buy) {
        id = tempStrat.buyStratBP.length;
        stratBoxName = 'buyStratBox';
        varDropdownName = 'buyVariableDropdown'
    }
    else {
        id = tempStrat.sellStratBP.length;
        stratBoxName = 'sellStratBox';
        varDropdownName = 'sellVariableDropdown';
    }
    let newthing;
    // first init object
    if (obj == null) { 
        newthing = {
            first: {
                type: 'price',
                params: GetDefaultStratVarParameters('price')
            },
            second: {
                type: 'price',
                params: GetDefaultStratVarParameters('price')
            },
            compareOp: '&lt',
            notted: false
        }
    }
    else {
        newthing = JSON.parse(JSON.stringify(obj));
    }

    // create html elements with correct display
    let containa = document.createElement('div');
    containa.style.display = 'inline';
    containa.style.padding = '4px 0px 4px 0px';

    // First compare
    if (newthing.first.type == 'math') {
        let skip = 0;
        for (let thing = 0; thing < newthing.first.params.mathBp.length; thing++) {
            if (skip > 0) {
                skip -= 1;
                continue;
            }
            // list only touches the objects, skips strings ('+', etc)
            let realObj = JSON.parse(JSON.stringify(newthing.first.params.mathBp[thing]));
            if (thing == 0) {
                // just create a first object normally
                containa.appendChild(CreateVarDiv(realObj.type, true, realObj.params, id, buy, thing));
                skip = 1;
                continue;
            }
            else {
                AppendMathElements(null, containa, realObj, newthing.first.params.mathBp[thing - 1], true, id, buy, thing);
                skip = 1;
            }
        }
    }
    else {
        containa.appendChild(CreateVarDiv(newthing.first.type, true, newthing.first.params, id, buy));
    }
    containa.appendChild(CreateMathButton(containa, true, id, buy, 0));
    if (buy)
        containa.appendChild(AddBuyCompareOp(id, newthing.compareOp));
    else
        containa.appendChild(AddSellCompareOp(id, newthing.compareOp));
    // second compare
    if (newthing.second.type == 'math') {
        let skip = 0;
        for (let thing = 0; thing < newthing.second.params.mathBp.length; thing++) {
            if (skip > 0) {
                skip -= 1;
                continue;
            }
            let realObj = JSON.parse(JSON.stringify(newthing.second.params.mathBp[thing]));
            if (thing == 0) {
                containa.appendChild(CreateVarDiv(realObj.type, false, realObj.params, id, buy, thing));
                skip = 1;
                continue;
            }
            else {
                AppendMathElements(null, containa, realObj, newthing.second.params.mathBp[thing - 1], false, id, buy, thing);
                skip = 1;
            }
        }
    }
    else {
        containa.appendChild(CreateVarDiv(newthing.second.type, false, newthing.second.params, id, buy));
    }
    containa.appendChild(CreateMathButton(containa, false, id, buy, 0));

    document.getElementById(stratBoxName).appendChild(containa);//.insertBefore(containa, document.getElementById(varDropdownName));

    // For deletions
    //TODO: in the future make it so you can drag to rearrange
    // to do that, change display or somethin, z index, and 
    //create dive to take place to keep the others staing in place
    containa.addEventListener('mouseenter', function(e) {
        this.style.backgroundColor = 'white';
    });
    containa.addEventListener('mouseleave', function(e) {
        this.style.backgroundColor = '';
    });
    containa.addEventListener('dblclick', function(e) {
        // Delete comparison element
        RemoveStratElement(id, buy);
    });

    //updating variables
    if (buy) {
        tempStrat.buyStratBP.push(newthing);
    }
    else {
        tempStrat.sellStratBP.push(newthing);
    }
    UpdateStratFileAndGraph(loading);
}

function GetDefaultStratVarParameters(varType) {
    /**
     * Returns default options (parameters) depending
     * on the type of variable in strategy.
     */
    let pramz = null;
    switch (varType) {
        case 'constant':
            pramz = {
                value: 1
            };
            break;
        case 'price':
            pramz = {
                ohlc: 'close',
                index: 0
            };
            break;
        case 'ma':
            pramz = {
                index: 0
            };
            break;
        case 'buy-price':
            pramz = {
                buyIndex: 0
            };
            break;
        case 'time-of-day':
            pramz = {
                units: 'minutes'
            };
            break;
        default:
            pramz = {};
            break;
    }
    return pramz;
}


function CreateLogicalOperatorDiv(o, indx, buy=true) {
    /**
     * Creates a div for logical operators (AND, OR) 
     * takes indication if on the buy or sell strat, and what its index is in the strat.
     * adds event listener for when they change to update the strat blueprint,
     * tempstrat and file, and chart[s].
     */
    let d = document.createElement('div');
    d.className = 'logicalOperators';
    d.innerHTML = o;
    d.style.display = 'inline';

    d.addEventListener('click', function(e) {
        if (d.innerHTML == "AND") {
            if (buy)
                tempStrat.buyStratBP[indx] = "OR";
            else
                tempStrat.sellStratBP[indx] = "OR";
            d.innerHTML = "OR";
        } 
        else {
            if (buy)
                tempStrat.buyStratBP[indx] = "AND";
            else
                tempStrat.sellStratBP[indx] = "AND";
            d.innerHTML = "AND";
        }
        UpdateStratFileAndGraph();
    });
    

    return d;
}


function AddBuyCompareOp(id, value = null) {
    return CreateComparisonOperatorDropdown(id, true, value);
}
function AddSellCompareOp(id, value = null) {
    return CreateComparisonOperatorDropdown(id, false, value);
}
function CreateComparisonOperatorDropdown(id, buy, valyou=null) {
    let container = document.createElement('div');
    container.className = "buyComparisonOperator";
    container.style.display = 'inline';

    let slect = document.createElement('select');
    slect.name = 'operatorSelect' + id;
    slect.className = 'operatorSelect';

    let optionList = ['&lt', '&gt', '&lt=', '&gt=', '==', '!='];
    let assbowl;
    for (let x = 0; x < optionList.length; x++) {
        assbowl = document.createElement('option');
        assbowl.value = optionList[x];
        assbowl.innerHTML = optionList[x];
        slect.appendChild(assbowl);
    }
    if (valyou != null)
        slect.value = valyou;
    slect.addEventListener('change', function(e) {
        //TODO: make this work
        //update blueprint and tempstrat
        if (buy) {
            tempStrat.buyStratBP[FindIndexInBlueprint(id)].compareOp = slect.value;
        }
        else {
            tempStrat.sellStratBP[FindIndexInBlueprint(id)].compareOp = slect.value;
        }
        UpdateStratFileAndGraph();
    });

    container.appendChild(slect);
    return container;
}

function CreateMathOperatorDropdown(id, buy, valyou, listIndex, isFirstComparison) {
    /**
     * does the stuff for the math operator dropdownz
     */
    let firstOrSec;
    if (isFirstComparison)
        firstOrSec = 'first';
    else
        firstOrSec = 'second';

    let container = document.createElement('div');
    container.className = "mathComparisonOperator";
    container.style.display = 'inline';

    let slect = document.createElement('select');
    slect.name = 'mathSelect' + id;
    slect.classname = 'mathSelect';

    let optionList = ['^', '*', '/', '+', '-'];
    let assbowl;
    for (let x = 0; x < optionList.length; x++) {
        assbowl = document.createElement('option');
        assbowl.value = optionList[x];
        assbowl.innerHTML = optionList[x];
        slect.appendChild(assbowl);
    }
    slect.value = valyou;
    slect.addEventListener('change', function(e){
        if (buy) {
            tempStrat.buyStratBP[FindIndexInBlueprint(id)][firstOrSec].params.mathBp[listIndex] = this.value;
        }
        else {
            tempStrat.sellStratBP[FindIndexInBlueprint(id)][firstOrSec].params.mathBp[listIndex] = this.value;
        }
        UpdateStratFileAndGraph();
    });
    container.appendChild(slect);
    return container;
}

function CreateStratTextInputForm(container, val, paramName, isFirstComparison, id, mathVarPosition, buy=true) {
    /**
     * Creates changeable text for strategy variable.
     */
    let firstOrSec;
    if (isFirstComparison)
        firstOrSec = 'first';
    else
        firstOrSec = 'second';

    let isInt = paramName == 'index';
    var displayDat = document.createElement('p');
    displayDat.innerHTML = val;
    if (val == 0) {
        if (paramName == 'index')
            displayDat.innerHTML = '0 (current)';
        else if (paramName == 'buyIndex')
            displayDat.innerHTML = '0 (first buy)';
        else
            displayDat.innerHTML = '0';
    } else if (val == 1) {
        if (paramName == 'index')
            displayDat.innerHTML = '1 (last)';
        else
            displayDat.innerHTML = '1';
    }

    var inpForm = document.createElement("form");
    var inpDiv = document.createElement("input");
    var inpSubDiv = document.createElement("input");
    inpDiv.type = "text";
    inpSubDiv.type = "submit";
    if (isInt)
        inpDiv.className = "numbInput";
    
    inpForm.style.display = 'none';
    inpForm.appendChild(inpDiv);
    inpForm.appendChild(inpSubDiv);


    inpForm.addEventListener('submit', function(e) {
        e.preventDefault();
        // TODO: input validation if not int
        if (inpDiv.value == '') return;
        let theVal = inpDiv.value;
        displayDat.innerHTML = theVal;
        if (theVal == 0 && paramName == 'index') {
            displayDat.innerHTML = '0 (current)';
        } else if (theVal == 1 && paramName == 'index') {
            displayDat.innerHTML = '1 (last)';
        }
        inpForm.style.display = 'none';
        displayDat.style.display = 'inline';
        inpDiv.value = '';

        let saveVal = theVal;
        
        //update the blueprint var, then tempstrat and finally tempstrat JSON file
            
        saveVal *= 1; //parse to number
        if (buy) {
            if (tempStrat.buyStratBP[FindIndexInBlueprint(id)][firstOrSec].type == 'math') {
                //TODO: why is mathbp in params bro
                tempStrat.buyStratBP[FindIndexInBlueprint(id)][firstOrSec].params.mathBp[mathVarPosition].params[paramName] = saveVal;
            }
            else {
                tempStrat.buyStratBP[FindIndexInBlueprint(id)][firstOrSec].params[paramName] = saveVal;
            }
        }
        else {
            if (tempStrat.sellStratBP[FindIndexInBlueprint(id)][firstOrSec].type == 'math') {
                tempStrat.sellStratBP[FindIndexInBlueprint(id)][firstOrSec].params.mathBp[mathVarPosition].params[paramName] = saveVal;
            }
            else {
                tempStrat.sellStratBP[FindIndexInBlueprint(id)][firstOrSec].params[paramName] = saveVal;
            }
        }
        UpdateStratFileAndGraph();
        
    });

    displayDat.addEventListener('click', function(e) {
        inpDiv.value = displayDat.innerHTML;
        displayDat.style.display = 'none';
        inpForm.style.display = 'inline';
        inpDiv.select();
        displayDat.innerHTML = '';
    });

    return [displayDat, inpForm];
}

function CreateVarDiv(varType, isFirstCompare, params, indexInList, buy, varMathPosition=0) {
    /**
     * Creates an html element for strategy variable (price, etc)
     */
    let firstOrSec;
    if (isFirstCompare)
        firstOrSec = 'first';
    else
        firstOrSec = 'second';
    // main container
    let mainContainy = document.createElement('div');
    mainContainy.style.margin = '0px 10px 0px 10px';
    // first container
    let containy = document.createElement('div');
    //containy.style.height = '40px';
    containy.style.backgroundColor = 'gray';
    containy.style.display = 'inline-grid';
    //containy.style.gridTemplateRows = '3fr 1fr';


    let divTitle = document.createElement('div');
    divTitle.style.borderBottom = '1px solid black';
    divTitle.appendChild(CreateVarTypeSelection(mainContainy, varType, indexInList, isFirstCompare, varMathPosition, buy));
    containy.appendChild(divTitle);

    if ('value' in params) {
        let valForm = document.createElement('div');
        let displayAndForm = CreateStratTextInputForm(valForm, params.value, 'value', isFirstCompare, indexInList, varMathPosition, buy);
        valForm.appendChild(displayAndForm[0]);
        valForm.appendChild(displayAndForm[1]);
        containy.appendChild(valForm);
    }
    // index
    if ('index' in params) {
        let bottomThing = document.createElement('div');
        let displayAndForm = CreateStratTextInputForm(bottomThing, params.index, 'index', isFirstCompare, indexInList, varMathPosition, buy);
        bottomThing.appendChild(displayAndForm[0]);
        bottomThing.appendChild(displayAndForm[1]);
        containy.appendChild(bottomThing);
    }
    if ('buyIndex' in params) {
        let bottomThing = document.createElement('div');
        let displayAndForm = CreateStratTextInputForm(bottomThing, params.buyIndex, 'buyIndex', isFirstCompare, indexInList, varMathPosition, buy);
        bottomThing.appendChild(displayAndForm[0]);
        bottomThing.appendChild(displayAndForm[1]);
        containy.appendChild(bottomThing);
    }
    if ('ohlc' in params) {
        let ohlcSelect = document.createElement('select');
        let open = document.createElement('option');
        open.value = 'open';
        open.innerHTML = 'open';
        let high = document.createElement('option');
        high.value = 'high';
        high.innerHTML = 'high';
        let low = document.createElement('option');
        low.value = 'low';
        low.innerHTML = 'low';
        let close = document.createElement('option');
        close.value = 'close';
        close.innerHTML = 'close';
        ohlcSelect.appendChild(open);
        ohlcSelect.appendChild(high);
        ohlcSelect.appendChild(low);
        ohlcSelect.appendChild(close);
        ohlcSelect.value = params.ohlc;
        containy.appendChild(ohlcSelect);

        ohlcSelect.addEventListener('change', function(e) {
            e.preventDefault();
            if (buy) {
                if (tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].type == 'math')
                    tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.mathBp[varMathPosition].params.ohlc = this.value;
                else
                    tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.ohlc = this.value;
            }
            else {
                if (tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].type == 'math')
                    tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.mathBp[varMathPosition].params.ohlc = this.value;
                else
                    tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.ohlc = this.value;
            }
            UpdateStratFileAndGraph();
        });
    }
    if ('units' in params) {
        // for time-of-day time of day
        let unitSelect = document.createElement('select');
        let minutes = document.createElement('option');
        minutes.value = 'minutes';
        minutes.innerHTML = 'minutes';
        let hourz = document.createElement('option');
        hourz.value = 'hours';
        hourz.innerHTML = 'hours';
        unitSelect.appendChild(minutes);
        unitSelect.appendChild(hourz);
        unitSelect.value = params.units;
        containy.appendChild(unitSelect);

        unitSelect.addEventListener('change', function(e) {
            if (buy) {
                if (tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].type == 'math')
                    tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.mathBp[varMathPosition].params.units = this.value;
                else
                    tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.units = this.value;
            }
            else {
                if (tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].type == 'math')
                    tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.mathBp[varMathPosition].params.units = this.value;
                else
                    tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.units = this.value;
            }
            UpdateStratFileAndGraph();
        });
    }

    mainContainy.appendChild(containy);

    return mainContainy;
}
function CreateMathButton(containerDiv, isFirstCompare, indexInList, buy, varMathPosition=0) {
    /**
     * creates math button because having it inside createvardiv was fucking stupid
     */
    let firstOrSec;
    if (isFirstCompare)
        firstOrSec = 'first';
    else
        firstOrSec = 'second';
    let mathButton = document.createElement('button');
    mathButton.innerHTML = '+';
    mathButton.addEventListener('click', function(e) {
        // data first

        let newVarObj = {
            type: 'constant',
            params: {value: 1}
        };
        newVarObj = JSON.stringify(newVarObj);
        // replaced buystratblueprint with tempstrat below
        if (buy) {
            if (tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].type == 'math') {
                tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.mathBp.push('+', JSON.parse(newVarObj));
            }
            else {
                let objPlaceholder = JSON.parse(JSON.stringify(tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec]));
                tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec] = {
                    type: 'math',
                    params: {
                        mathBp: [JSON.parse(JSON.stringify(objPlaceholder)), '+', JSON.parse(newVarObj)]
                    }
                };
            }
        }
        else {
            if (tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].type == 'math') {
                tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.mathBp.push('+', JSON.parse(newVarObj));
            }
            else {
                let objPlaceholder = JSON.parse(JSON.stringify(tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec]));
                tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec] = {
                    type: 'math',
                    params: {
                        mathBp: [JSON.parse(JSON.stringify(objPlaceholder)), '+', JSON.parse(newVarObj)]
                    }
                };
            }
        }
        UpdateStratFileAndGraph();
        // now update divs
        varMathPosition += 2;
        AppendMathElements(this, containerDiv, JSON.parse(newVarObj), '+', isFirstCompare, indexInList, buy, varMathPosition);
    });
    return mathButton;
}

function AppendMathElements(mathButton, containerDiv, secondVar, mathOp, isFirstCompare, indexInList, buy, newVarPosition) {
    /**
     * creates math shit on page
     */
    let opDropdown = CreateMathOperatorDropdown(indexInList, buy, mathOp, newVarPosition - 1, isFirstCompare);
    let secondVarDiv = CreateVarDiv(secondVar.type, isFirstCompare, secondVar.params, indexInList, buy, newVarPosition);
    if (mathButton) {
        containerDiv.insertBefore(opDropdown, mathButton);
        containerDiv.insertBefore(secondVarDiv, mathButton);
    }
    else {
        containerDiv.appendChild(opDropdown);
        containerDiv.appendChild(secondVarDiv);
    }
}

function CreateVarTypeSelection(containerDiv, initType, id, isFirstComparison, mathVarPosition, buy) {
    /**
     * Cleaner code.
     * creates and returns var type selection
     * The types: price - ohlc, indicators, and constants
     */
    let firstOrSec;
    if (isFirstComparison)
        firstOrSec = 'first';
    else
        firstOrSec = 'second';
    
    let varSelection = document.createElement('select');
    let constOptn = document.createElement('option');
    constOptn.value = 'constant';
    constOptn.innerHTML = 'constant';
    let priceOptn = document.createElement('option');
    priceOptn.value = 'price';
    priceOptn.innerHTML = 'price';
    let boughtOptn = document.createElement('option');
    boughtOptn.value = 'buy-price';
    boughtOptn.innerHTML = 'bought price';
    let todOptn = document.createElement('option');
    // TODO: time of day doesn't care if the market closes early etc
    todOptn.value = 'time-of-day';
    todOptn.innerHTML = 'time of day';
    varSelection.appendChild(constOptn);
    varSelection.appendChild(priceOptn);
    varSelection.appendChild(boughtOptn);
    varSelection.appendChild(todOptn);

    //when indicator data is changed, we need to update name in this div
    // like indicator added, removed, or params changed
    for (let indic = 0; indic < tempStrat.indicators.length; indic++) {
        let newOptn = document.createElement('option');
        newOptn.value = tempStrat.indicators[indic].type;
        newOptn.innerHTML = tempStrat.indicators[indic].type;
        varSelection.appendChild(newOptn);
    }


    varSelection.value = initType;

    varSelection.addEventListener('change', function(e) {
        e.preventDefault();
        // update vars and file, then delete div and recreate
        //update the blueprint var, then tempstrat and finally tempstrat JSON file
        let newObj = {
            type: this.value,
            params: GetDefaultStratVarParameters(this.value)
        };
        // replaced buystratblueprint and sell below with tempstrat
        if (buy) {
            if (tempStrat.buyStratBP[FindIndexInBlueprint(id)][firstOrSec].type == 'math')
                tempStrat.buyStratBP[FindIndexInBlueprint(id)][firstOrSec].params.mathBp[mathVarPosition] = JSON.parse(JSON.stringify(newObj));
            else
                tempStrat.buyStratBP[FindIndexInBlueprint(id)][firstOrSec] = JSON.parse(JSON.stringify(newObj));
        }
        else {
            if (tempStrat.sellStratBP[FindIndexInBlueprint(id)][firstOrSec].type == 'math')
                tempStrat.sellStratBP[FindIndexInBlueprint(id)][firstOrSec].params.mathBp[mathVarPosition] = JSON.parse(JSON.stringify(newObj));
            else
                tempStrat.sellStratBP[FindIndexInBlueprint(id)][firstOrSec] = JSON.parse(JSON.stringify(newObj));
        }
        UpdateStratFileAndGraph();
        // now update webpage
        ResetVarDiv(containerDiv, isFirstComparison, id, mathVarPosition, buy);
    });
    return varSelection;
}
function ResetVarDiv(divItem, isFirst, id, mathVarPosition, buy) {
    // TODO: am i causing memory leaks??
    let firstOrSec;
    if (isFirst)
        firstOrSec = 'first';
    else
        firstOrSec = 'second';
    let objDat;
    if (buy) {
        if (tempStrat.buyStratBP[FindIndexInBlueprint(id)][firstOrSec].type == 'math')
            objDat = tempStrat.buyStratBP[FindIndexInBlueprint(id)][firstOrSec].params.mathBp[mathVarPosition];
        else
            objDat = tempStrat.buyStratBP[FindIndexInBlueprint(id)][firstOrSec];
    } else {
        if (tempStrat.sellStratBP[FindIndexInBlueprint(id)][firstOrSec].type == 'math')
            objDat = tempStrat.sellStratBP[FindIndexInBlueprint(id)][firstOrSec].params.mathBp[mathVarPosition];
        else
            objDat = tempStrat.sellStratBP[FindIndexInBlueprint(id)][firstOrSec];
    }
    // TODO: save params? like if you switch var then go bakc yanno??

    let parentDiv = divItem.parentElement;
    console.log(mathVarPosition);
    console.log(objDat);
    let newVarDiv = CreateVarDiv(objDat.type, isFirst, objDat.params, id, buy, mathVarPosition);
    parentDiv.replaceChild(newVarDiv, divItem);
}

function GenerateLowerStrategy(buyBluep, sellBluep, loading=false) {
    /**
     * Creates the html elements for the strategies after clearing them.
     * if we loading in a saved strat, dont update tempstrat file.
     */
    let buyBP = JSON.parse(JSON.stringify(buyBluep));
    let sellBP = JSON.parse(JSON.stringify(sellBluep));
    ClearLowerStrategy();
    let skip = false;
    for (let i = 0; i < buyBP.length; i++) {
        if (skip) {
            skip = false;
            continue;
        }
        if (typeof buyBP[i] == "string") {
            // AND or OR
            AddBuyComparison(buyBP[i], buyBP[i + 1], loading);
            //skip next one
            skip = true;
        }
        else {
            // object
            // only happens if first one
            AddBuyComparison(null, buyBP[i], loading);
        }
    }
    // Now repeat for sellstrat
    skip = false;
    for (let i = 0; i < sellBP.length; i++) {
        if (skip) {
            skip = false;
            continue;
        }
        if (typeof sellBP[i] == "string") {
            AddSellComparison(sellBP[i], sellBP[i + 1], loading);
            skip = true;
        }
        else {
            // TODO: don't think the json.stringify and parse are necessary
            AddSellComparison(null, JSON.parse(JSON.stringify(sellBP[i])), loading);
        }
    }

}
function ClearLowerStrategy() {
    /**
     * Reset bottom strategy box
     */
    // ez clear
    document.getElementById('buyStratBox').innerHTML = '';
    document.getElementById('sellStratBox').innerHTML = '';
}

function RemoveStratElement(id, buy) {
    /**
     * Removes a comparison div
     */
    console.log('id:',id)
    // copy list
    let stratBlueprint;
    let unchangedBlueprint;
    if (buy) {
        stratBlueprint = JSON.parse(JSON.stringify(tempStrat.buyStratBP));
        unchangedBlueprint = JSON.parse(JSON.stringify(tempStrat.sellStratBP));
    }
    else {
        stratBlueprint = JSON.parse(JSON.stringify(tempStrat.sellStratBP));
        unchangedBlueprint = JSON.parse(JSON.stringify(tempStrat.buyStratBP));
    }
    // TODO: make this work with parenthesis
    // if first elem, delete first and logic operator after
    if (id == 0) {
        stratBlueprint.splice(0,2);
    }
    else {
        stratBlueprint.splice(id - 1, 2)
    }
    // clear tempstrat blueprint
    // clear & regenerate bottom bottom
    if (buy) {
        tempStrat.buyStratBP = [];
        tempStrat.sellStratBP = [];
        GenerateLowerStrategy(stratBlueprint, unchangedBlueprint);
    }
    else {
        tempStrat.buyStratBP = [];
        tempStrat.sellStratBP = [];
        GenerateLowerStrategy(unchangedBlueprint, stratBlueprint);
    }
    // the file and graph are only updated when stuff is added,
    // so if it's all empty now we need to update it
    if (tempStrat.buyStratBP == [] && tempStrat.sellStratBP == [])
        UpdateStratFileAndGraph();
    

}


function SearchForId(id) {

}

function FindIndexInBlueprint(objNumber) {
    // if u want, in the future you'd get the index number, adding but skipping logical ops
    return objNumber;
}

function ParseStratBlueprint(bp) {
    if (bp.length == 0) return;
    // If there's only one comparison, return it
    if (bp.length == 1) 
        return bp[0];

    // what firstpass do??
    let firstPass = [];

    // First, group ANDs and parenthesis
    let skip = 0;
    //what this do???
    //apparently using x is fucked and u can't do x + 1
    for (let xi = 0; xi < bp.length; xi++) {
        if (skip != 0) {
            skip -= 1;
            continue;
        }

        // Would this work?
        /* if (bp[xi] == 'NOT') {

        }*/
        //TODO: adding these firstop n secondop
        let firstop = bp[xi];
        // second index could change
        let secondopIndex = xi + 2;
        if (bp[xi] == '(') { // first item is parenthesis.
            
            // Get inside data of parenthesis and parse that.
            // deta[0] is blueprint inside parens, deta[1] is index of ')'.
            let deta = GetInsideParenthesis(bp, xi);
            if (deta[1] + 1 == bp.length) // nothing to compare to, hit the end
            {
                firstPass.push(ParseStratBlueprint(deta[0]));
                break;
            }
            // if it's an OR after, we push normally. 
            if (bp[deta[1] + 1] == 'OR') {
                // push parenthesis object
                firstPass.push(ParseStratBlueprint(deta[0]));
                // the next time this loop is ran, it will run on the OR
                xi = deta[1];
                continue;
            }

            //Below code is ran if it's being ANDed

            // jump to second item
            xi = deta[1] + 2;

            let sefcondItem = bp[xi];
            // second comparison is also parenthess
            if (bp[deta[1] + 2] == '(') {
                let secdeta = GetInsideParenthesis(bp, deta[1] + 2);
                sefcondItem = ParseStratBlueprint(secdeta[0]);
                // jump to end of second item
                xi = secdeta[1];
            }
            firstPass.push(CreateLogicObject(ParseStratBlueprint(deta[0]), sefcondItem, bp[deta[1] + 1], false));
        }
        // First item is object
        else if (bp[xi + 1] == "AND") {
            let firstItem = bp[xi];
            let secondItem = bp[xi + 2];
            if (secondItem == '(') {
                let secdeta = GetInsideParenthesis(bp, xi + 2);
                sefcondItem = ParseStratBlueprint(secdeta[0]);
            }
            firstPass.push(CreateLogicObject(bp[xi], bp[xi + 2], '&&', false));
            skip = 2;
        }
        // if two ands in a row. only can reach here if it's right after skip
        else if (bp[xi] == "AND") {
            firstPass[firstPass.length - 1] = CreateLogicObject(firstPass[firstPass.length - 1], bp[xi + 1], '&&', false);
            skip = 1;
        }
        // we not keepin the ors, ors is all that's left
        else if (bp[xi] != "OR") {
            firstPass.push(bp[xi]);
        }
    }
    console.log('FirstPass: ');
    console.log(firstPass);
    // if it was only ANDs
    if (firstPass.length == 1) {
        return firstPass[0];
    }

    finalObject = {};
    //Second, group ORs
    for (xi = 0; xi < firstPass.length; xi += 2) {
        console.log(xi);
        // first one
        if (xi == 0) {
            finalObject = CreateLogicObject(firstPass[0], firstPass[1], '||', false);
        }
        // if this is the last item
        else if (xi == firstPass.length - 1) {
            finalObject = CreateLogicObject(finalObject, firstPass[xi], '||', false);
        }
        else {
            finalObject = CreateLogicObject(finalObject, CreateLogicObject(firstPass[xi], firstPass[xi + 1], '||', false), '||', false);
        }
    }
    // yayyyy
    return finalObject;
}

function ParseMathBlueprint(bp) {
    /**
     * PEMDAS - operations done first are the deepest objects
     * {firstOperand: a, secondOperand: b, operator: '*'}
     * it runs through the whole list for each possible operation.
     * when it finds that operation, it converts it to object and
     * pushes to slowList.
     * Let's gooo
     */
    console.log(bp);
    // if length is 3, just return top obj
    if (bp.length == 3) return CreateMathObject(bp[0], bp[2], bp[1]);

    //make it go kinda faster if I declare these before loop
    let firstOpAnd;
    let secondOpAnd;

    // slowList slowly converts the list into one single object
    let slowList = [];
    // parentheses first
    for (let iter = 0; iter < bp.length; iter++) {
        firstOpAnd = bp[iter];
        if (firstOpAnd == '(') {
            let insideParens = GetInsideParenthesis(bp, iter);
            if (insideParens[1] + 1 == bp.length) { // literally whole thing was in parenthesis
                return ParseMathBlueprint(insideParens[0]);
            }
            //slowList.push(ParseMathBlueprint(insideParens[0]));
            //not gonna risk not using json lol
            slowList.push(ParseMathBlueprint(JSON.parse(JSON.stringify(insideParens[0]))));
            iter = insideParens[1];
            continue;
        }
        else {
            slowList.push(bp[iter]);
        }

    }
    // Exponents
    let newSlowList = [];
    for (let iter = 0; iter < slowList.length; iter++) {
        // TODO: check if this actually works
        // exponents are goin right to left bc i decided
        firstOpAnd = slowList[iter];
        if (slowList[iter + 1] == '^') {
            let opIndexes = iter + 1;
            while (slowList[opIndexes + 2] == '^') {
                opIndexes += 2;
            }
            let indexPlaceHolder = opIndexes + 1;
            // now go backwards
            let expList = [];
            while (opIndexes > iter) {
                firstOpAnd = slowList[opIndexes - 1];
                secondOpAnd = slowList[opIndexes + 1];
                // add to beginning of array
                expList.unshift(CreateMathObject(firstOpAnd, secondOpAnd, '^'));
                opIndexes -= 2;
            }
            for (let obj = 0; obj < expList.length; obj++) {
                newSlowList.push(expList[obj]);
            }
            iter = indexPlaceHolder;
        }
        else {
            newSlowList.push(slowList[iter]);
        }
    }
    // if we done
    if (newSlowList.length == 1) return newSlowList[0];
    //moving back to slowList
    slowList = [];
    // multiplication and division. no idea if this will work
    for (let iter = 0; iter < newSlowList.length; iter++) {
        if (newSlowList[iter + 1] == '*' || newSlowList[iter + 1] == '/') {
            firstOpAnd = newSlowList[iter];
            secondOpAnd = newSlowList[iter + 2];
            slowList.push(CreateMathObject(firstOpAnd, secondOpAnd, newSlowList[iter + 1]));
            iter += 2;
        }
        else if (newSlowList[iter] == '*' || newSlowList[iter] == '/') { // we only get here if we just made a math obj above
            // replace last item in slowlist
            let newObj = CreateMathObject(slowList.pop(), newSlowList[iter + 1], newSlowList[iter]);
            slowList.push(newObj);
            iter += 1;
        }
        else {
            slowList.push(newSlowList[iter]);
        }
    }
    if (slowList.length == 1) return slowList[0];
    //add and subtraction, moving back to newslowlist
    newSlowList = [];
    for (let iter = 0; iter < slowList.length; iter++) {
        if (slowList[iter + 1] == '+' || slowList[iter + 1] == '-') {
            firstOpAnd = slowList[iter];
            secondOpAnd = slowList[iter + 2];
            newSlowList.push(CreateMathObject(firstOpAnd, secondOpAnd, slowList[iter + 1]));
            iter += 2;
        }
        else if (slowList[iter] == '+' || slowList[iter] == '-') {
            let newObj = CreateMathObject(newSlowList.pop(), slowList[iter + 1], slowList[iter]);
            newSlowList.push(newObj);
            iter += 1;
        }
        else {
            newSlowList.push(slowList[iter]);
        }
    }
    console.log(newSlowList);
    // if it actually worked, should only have one item in array
    if (newSlowList.length > 1) alert('MathObject list has more than one element!!');
    return newSlowList[0];
}
function AddMathObjects() {
    /**
     * adds parsed math objects to EVERY FUCKIN strat object that has a blueprint
     */
    // buystratblueprint and sell replaced with tempstrat
    if (tempStrat.buyStratBP.length > 0) {
        for (let item = 0; item < tempStrat.buyStratBP.length; item++) {
            if (typeof tempStrat.buyStratBP[item] != 'string') {
                if (tempStrat.buyStratBP[item].first.type == 'math') {
                    tempStrat.buyStratBP[item].first.params.mathObject = ParseMathBlueprint(tempStrat.buyStratBP[item].first.params.mathBp);
                }
                if (tempStrat.buyStratBP[item].second.type == 'math') {
                    tempStrat.buyStratBP[item].second.params.mathObject = ParseMathBlueprint(tempStrat.buyStratBP[item].second.params.mathBp);
                }
            }
        }
    }
    if (tempStrat.sellStratBP.length > 0) {
        for (let item = 0; item < tempStrat.sellStratBP.length; item++) {
            if (typeof tempStrat.sellStratBP[item] != 'string') {
                if (tempStrat.sellStratBP[item].first.type == 'math') {
                    tempStrat.sellStratBP[item].first.params.mathObject = ParseMathBlueprint(tempStrat.sellStratBP[item].first.params.mathBp);
                }
                if (tempStrat.sellStratBP[item].second.type == 'math') {
                    tempStrat.sellStratBP[item].second.params.mathObject = ParseMathBlueprint(tempStrat.sellStratBP[item].second.params.mathBp);
                }
            }
        }
    }
}

function GetInsideParenthesis(itemList, startIndex) {
    /**
     * This function returns a blueprint list in between parenthesis. The reason it 
     * exists is to break up and process what's inside of parenthesis, because
     * it boils down to a single boolean.
     * 
     * Takes whole blueprint list and index of opening parenthesis.
     * Returns a list: [blueprint (everything between parenthesis'), index of closing parenthesis]
     */
    let newImprovedSpunkyList = [];
    // counts inside groups
    let newParenthsCount = 0;
    // I CHANGED FOR LOOP TO CUTE < ITEMLIST.LENGTH, IT WAS CUTE > ITEMLIST.LENGTH
    // pretty sure that's not what i meant to do.
    for (let cute = startIndex + 1; cute < itemList.length; cute++) {
        if (itemList[cute] == ')' && newParenthsCount == 0)
            return [newImprovedSpunkyList, cute];
        else if (itemList[cute] ==')') {
            // close one group
            newParenthsCount -= 1;
        }
        else if (itemList[cute] == '(') {
            newParenthsCount += 1;
        }
        newImprovedSpunkyList.push(itemList[cute]);
    }
    alert('parenthesis parse error - didnt find ending parenthesi');
}

function CreateLogicObject(firstly, sec, op, nott) {
    return {logic: op, firstExpression: firstly, secondExpression: sec, notted: nott};
}
function CreateMathObject(firstOne, secondOne, op) {
    return {firstOperand: firstOne, secondOperand: secondOne, operator: op};
}

// The mothership that returns true/false based on the strat
// just pass in strat object
// did this get replaced by evalobject in chart class?? - maybe delete
function EvaluateObject(obj) {
    let x;
    if (obj.hasOwnProperty('logic'))
        x = EvalBools(EvaluateObject(obj.firstExpression), EvaluateObject(obj.secondExpression), obj.logic);
    else
        x = EvalVars(obj.first, obj.second, obj.compareOp);
    if (obj.notted)
        x = !x;
    return x;
}

function EvalVars(first, second, operator) {
    switch (operator) {
        case '&lt':
            return first < second;

        case '&gt':
            return first > second;
        
        case '&lt=':
            return first <= second;

        case '&gt=':
            return first >= second;

        case '==':
            return first == second;

        case '!=':
            return first != second;
        
        default:
            alert('comarison error. operator was ' + operator);
            break;
    }
}

function EvalBools(first, second, operator) {
    switch (operator) {
        case '&&':
            return first && second;
        case '||':
            return first || second;
        default:
            alert('comparebools error. operator was ' + operator);
            break;
    }
}

function EvalMath(first, second, operator) {
    // if one of the variable indexes is out of range
    if (first == 'no' || second == 'no') return 'no';
    switch (operator) {
        case '^':
            return Math.pow(first, second);
        case '*':
            return first * second;
        case '/':
            return first / second;
        case '+':
            return first + second;
        case '-':
            return first - second;
        default:
            alert('EvalMath error - operator was ' + operator);
    }
}