/**
 * Ctrl-z ?
 * indicators not loading in until shit is changed
 * ask if u wanna save before closing window ?
 * obvsly loading in data
 * 
 * MA not working when u load in a strat
 * load previous state
 */

const styling = require('./javascripts/stratman/stylizing.js');
const {Chart, IndicatorIsUpperChart, GetRelevantChartIndex } = require('./javascripts/stratman/Chart.js');
const { Graph } = require('./javascripts/stratman/Graph.js');
const LoadFile = require('./javascripts/stratman/LoadFile.js');
const graphElements = require('./javascripts/stratman/graphElements.js');
const apiStuff = require("./javascripts/stratman/apiStuff.js");
const fs = require('fs');
const csv = require('fast-csv');

const qm = require('./javascripts/stratman/QuickMafs.js');

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
const afterHoursElement = document.getElementById('afterHours')

// tempStrat.buyStratBp puts the strat in order
// [{first, second, etc}, '&&', {first, second, etc}]
const blankStrat = {
    token: {},
    charts: [{pair: ""},{pair: ""}],
    indicators: [],
    lindicators: [], // lower indicators
    buyStratBP: [],
    sellStratBP: [],
    shorting: false,
    noAfterHours: false
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
afterHoursElement.addEventListener('change', function(e) {
    tempStrat.noAfterHours = afterHoursElement.checked;
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
            //console.log([tokType, apiTokens[tokType][tok]]);
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
    console.log("Loaded object:");
    console.log(stratObj);
    //tempStrat.buyStratBP = [];
    //tempStrat.sellStratBP = [];
    
    // write to tempstrat file
    if (!resetting) ipcRenderer.send('currentStrat:updateFile', stratObj);
    // load token
    // This will bring 'krakentokenname' etc
    
    if (!resetting) {
        if (stratObj.token != "none")
            apiSelector.value = stratObj.token[0] + stratObj.token[1].name;
        else
            apiSelector.value = "none";
    }
    tempStrat.token = GetSelectedToken();


    // load pair/graph
    // delete first
    for (let i = 0; i < chartList.length; i++) {
        chartList[i].RemoveHTML();
    }
    numOfCharts = 0;
    // Chart.js adds its own Chart object when created to this list
    chartList = [];
    // this seems to work for the file link shit
    tempStrat.charts = stratObj.charts;
    for (let thing = 0; thing < stratObj.charts.length; thing++) {
        CreateAChart(stratObj.charts[thing]);
    }

    // reset then load indicators
    for (let thing = 0; thing < indicatorDivList.length; thing++) {
        RemoveIndicatorHTML(indicatorDivList[thing]);
    }
    //console.log(tempStrat.indic)
    indicatorDivList = [];
    for (let thing = 0; thing < stratObj.indicators.length; thing++) {
        AddIndicator(stratObj.indicators[thing].type, stratObj.indicators[thing].params, true);
    }
    // now we add the indicators to tempstrat (does it matter if we put this above last funcs?)
    tempStrat.indicators = stratObj.indicators;
    
    //TODO: save window scroll/zoom

    // Load bottom strategy
    shortingElement.checked = tempStrat.shorting;
    // generate strats
    // TODO generatelowerstrategy adds strategies to tempstrat.
    // I feel like it should already be added. or maybe not.
    // it's just messy to be setting it for some things (like indicator lists)
    // and not for things like the strategy.
    tempStrat.buyStratBP = stratObj.buyStratBP;
    tempStrat.sellStratBP = stratObj.sellStratBP;
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
    let lowerIndicator = false;
    var newDiv;
    var container = document.getElementById("indicatorList");
    var indButton = document.getElementById("adder");
    let paramtrs = savedParams; // each case will default to saved params unless they aint saved
    let indicator = {type: ind} // i think if we change paramtrs after this it will change here...
    let divString;
    switch (ind) {
        case 'MA':
            if (!savedParams) {
                let defaultPeriod = 5;
                paramtrs = {
                    period: defaultPeriod,
                    color: '#000000'
                };

            }
            divString = "Moving Average";
            /*
            indicator = {
                type: ind,
                params: paramtrs
            };*/

            break;
        case 'BOL':
            if (!savedParams) {
                let defaultPeriod = 20;
                let defaultSTDs = 2;
                paramtrs = {
                    period: defaultPeriod,
                    m: defaultSTDs,
                    color: '#000000'
                }
            }
            divString = "Bollinger Bands";
            break;
        lowerIndicator = true;
        //##############################Lower chart##############################
        case 'VOL':
            // check if vol exists already
            for (let j = 0; j < tempStrat.indicators.length; j++)
            {
                if (tempStrat.indicators[j].type == "VOL") return;
            }
            if (!savedParams)
            {
                paramtrs = {
                    color: "Red"
                }
            }
            divString = "Volume";
            break;
        default:
            break;
    }
    // dbl check this
    indicator.params = paramtrs;
    newDiv = graphElements.CreateIndDiv(divString, paramtrs);

    container.insertBefore(newDiv, indButton);
    indicatorDivList.push(newDiv);
    if (!doNotWriteFile) { // As of rn, this means we just clicked the button to add indicator (not loading)
        //THIS IS THE FUCKING CULPRIT DGODDAMNNN
        tempStrat.indicators.push(indicator);
        
        ipcRenderer.send('currentStrat:updateFile', tempStrat);

        // and now update the lower strat. I technically could go in and just add to each div's
        // individual select element, but fuck that. just reset whole thing
        GenerateLowerStrategy(tempStrat.buyStratBP, tempStrat.sellStratBP, true); //ERROR FIXME

    }

    // POSSIBLE CHART OPTIMIZE - when loading a strat
    // if chart exists, update indicators
    for (let i = 0; i < chartList.length; i++) {
        if (chartList[i].parsedDat.length == 0) continue;
        chartList[i].UpdateIndicatorDat(tempStrat.indicators.length - 1);
    }
    //UpdateIndicatorDivs();
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
        // bro i'm just adding shit everywhere
        if (paramName == "period") // this is supposed to make it so strat var divs update from like MA12 to MA15
        {
            GenerateLowerStrategy(tempStrat.buyStratBP, tempStrat.sellStratBP, true);
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

    //calculations for removing from chart classes
    let isUpper = IndicatorIsUpperChart(tempStrat.indicators[tmpIndex].type);
    let indChartIndex = GetRelevantChartIndex(tmpIndex);
    // we're gonna pass in [isupperchart, index]
    if (isUpper)
    {
        indChartIndex = [true, indChartIndex];
    }
    else
    {
        indChartIndex = [false, indChartIndex];
    }
    console.log(indChartIndex);


    // remove from tempstrat
    tempStrat.indicators.splice(tmpIndex, 1);
    // remove from list that gives index
    indicatorDivList.splice(tmpIndex, 1);
    // update temp file
    ipcRenderer.send('currentStrat:updateFile', tempStrat);

    // remove the calculated data list from chart
    for (let i = 0; i < chartList.length; i++) {
        if (chartList[i].parsedDat.length == 0) continue;
        chartList[i].UpdateIndicatorDat(tmpIndex, indChartIndex);
    }
    // aaaand finally
    RemoveIndicatorHTML(divElement);
    // UPDATE STRATEGY
        
    ipcRenderer.send('currentStrat:updateFile', tempStrat);

    // and now update the lower strat. I technically could go in and just add to each div's
    // individual select element, but fuck that. just reset whole thing
    GenerateLowerStrategy(tempStrat.buyStratBP, tempStrat.sellStratBP, true); //ERROR FIXME
}
function RemoveIndicatorHTML(divElement) {
    divElement.remove();
}

// #############################################################################################
/*
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
*/

// #############################################################################################

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
        apiStuff.GetTheCandles(dat[i], chartList.length - 1);
        
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

// GetTheCandles used to b here

// couldnt keep this in chart class, idk why???
function UpdateCharts() {
    // update every chart when one is
    for (let i = 0; i < chartList.length; i++)
    {
        if (chartList[i].pair == '') continue;
        apiStuff.GetTheCandles(chartList[i].pair, i);
    }
}

// Chart class used to be here

// Graph class used to be here


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
    console.log('tempstratbp:')
    console.log(JSON.parse(JSON.stringify(tempStrat.buyStratBP)));
    console.log(tempStrat);
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
        AddBuyLogicOp(logicop, loading);
    
    AddComparison(obj, true, loading);
}
function AddBuyLogicOp(o, loading) {
    document.getElementById('buyStratBox').appendChild(CreateLogicalOperatorDiv(o, tempStrat.buyStratBP.length));
    if (!loading)
        tempStrat.buyStratBP.push(o);
}
function AddSellComparison(logicop=null, obj=null, loading=false) {
    // TODO: check if blueprint length is empty, then skip
    if (logicop != null) {
        AddSellLogicOp(logicop, loading);
    }
    AddComparison(obj, false, loading);
}
function AddSellLogicOp(o, loading) {
    document.getElementById('sellStratBox').appendChild(CreateLogicalOperatorDiv(o, tempStrat.sellStratBP.length, false));
    if (!loading)
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
    if (loading) // ERROR FIXME might fuck up loading in strats. but this fixed adding indicator
        id--;

    let newthing;
    // first init object
    if (obj == null) { 
        newthing = {
            first: {
                type: 'price',
                params: GetDefaultStratVarParameters('price'),
                tsId: ''
            },
            second: {
                type: 'price',
                params: GetDefaultStratVarParameters('price'),
                tsId: ''
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
    // this might fuck up loading in strats
    if (!loading)
    {
        if (buy) {
            tempStrat.buyStratBP.push(newthing);
        }
        else {
            tempStrat.sellStratBP.push(newthing);
        }
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
        case 'MA':
            pramz = {
                index: 0
            };
            break;
        case 'BOL':
            pramz = {
                band: 'upper band',
                index: 0 // TODO add upper, lower bands, sma
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
        case 'VOL':
            pramz = {
                index: 0
            }
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
    function CreateVarDivDropdownOption(paramType, values)
    {
        /**
         * Creates and returns dropdown to specify what part of the indicator/data we're using
         */
        let selectEl = document.createElement('select');
        for (let i = 0; i < values.length; i++)
        {
            let op = document.createElement('option');
            op.value = values[i];
            op.innerHTML = values[i];
            selectEl.appendChild(op);
        }
        selectEl.value = params[paramType]; // where does params choose this
        selectEl.addEventListener('change', function(e) {
            if (buy) {
                if (tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].type == 'math')
                    tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.mathBp[varMathPosition].params[paramType] = this.value;
                else
                    tempStrat.buyStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params[paramType] = this.value;
            }
            else {
                if (tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].type == 'math')
                    tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params.mathBp[varMathPosition].params[paramType] = this.value;
                else
                    tempStrat.sellStratBP[FindIndexInBlueprint(indexInList)][firstOrSec].params[paramType] = this.value;
            }
            UpdateStratFileAndGraph();
        });
        return selectEl;
    }

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


    let divChartRef = document.createElement('div');
    divChartRef.style.borderBottom = '2px dotted gray';
    divChartRef.appendChild(CreateVarChartSelection(mainContainy));
    containy.appendChild(divChartRef);

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
    if ('band' in params) {
        containy.appendChild(CreateVarDivDropdownOption('band', ["upper band", "middle band", "lower band"]));
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

function CreateVarChartSelection(containerDiv)
{
    // TODO add actual functionality
    
    let chartSelection = document.createElement('select');
    for (let i = 0; i < chartList.length; i++)
    {
        let chartOptn = document.createElement('option');
        chartOptn.value = chartList[i].name;
        chartOptn.innerHTML = chartOptn.value;
        chartSelection.appendChild(chartOptn);
    }
    return chartSelection;
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
        let indObj = tempStrat.indicators[indic];
        let newOptn = document.createElement('option');
        newOptn.value = indObj.type;
        newOptn.innerHTML = indObj.type;
        if (indObj.params.hasOwnProperty('period'))
        {
            newOptn.innerHTML += indObj.params.period;
        }
        newOptn.id = indic; // use this to reference tempstrat.indicators
        varSelection.appendChild(newOptn);
    }


    varSelection.value = initType;

    varSelection.addEventListener('change', function(e) {
        e.preventDefault();
        // update vars and file, then delete div and recreate
        //update the blueprint var, then tempstrat and finally tempstrat JSON file
        let newObj = {
            type: this.value,
            params: GetDefaultStratVarParameters(this.value),
            tsId: this.options[this.options.selectedIndex].id // id of selected option elem
        };
        console.log(this.id);
        // replaced buystratblueprint and sell below with tempstrat
        if (buy) {
            // console.log(id)
            // console.log(FindIndexInBlueprint(id));
            // console.log(tempStrat.buyStratBP);
            // console.log(tempStrat.buyStratBP[FindIndexInBlueprint(id)]);
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
    // TODO figure out wtf the belowline means. and parentdiv works??
    // TODO: save params? like if you switch var then go bakc yanno??

    let parentDiv = divItem.parentElement;
    // console.log(mathVarPosition);
    // console.log(objDat);
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
    console.log("buyBP")
    console.log(buyBP);
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
            AddBuyComparison(null, buyBP[i], loading); // this is fucking up tempstrat buybp etc when add ind
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