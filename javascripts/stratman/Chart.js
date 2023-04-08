// This shit's bloating my code so i moved it to its own file

//const LoadFile = require('./LoadFile.js');
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
        this.canvasWidth = 1000;
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
        // will need to update names
        this.name = "Chart " + chartList.length;

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

        // load from file
    
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

        //console.log(tempStrat.charts[0]);
        // load from file
        let lf = new LoadFile.FileLoader(myIndex);
        this.maincontain.appendChild(lf.mainElement);
    
        //canv
        // TODO: calculate width and height based on current myIndex
        let theCanvas = document.createElement('canvas');
        theCanvas.innerHTML = 'not loading';
        theCanvas.id = 'graph' + myIndex;
        theCanvas.className = 'graph';
        theCanvas.width = this.canvasWidth.toString();
        theCanvas.height = '450';
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
    ParseAPIData(backtestData)
    {
        /// goes thru each candlestick and
        /// turns it into readable data.
        /// this method will be used for each
        /// exchange, and the resulting data
        /// will be in the same format across
        /// each one.
        this.candts = 0;
        this.candopen = 0;
        this.candhigh = 0;
        this.candlow = 0;
        this.candclose = 0;
        this.candvol = 0;
        this.candtrades = 0;
        for (let candle = 0; candle < backtestData.length; candle++)
        {
            if (this.apiType == 'kraken')
            {

                this.candts = backtestData[candle][0];
                this.candopen = parseFloat(backtestData[candle][1]);
                this.candhigh = parseFloat(backtestData[candle][2]);
                this.candlow = parseFloat(backtestData[candle][3]);
                this.candclose = parseFloat(backtestData[candle][4]);
                this.candvol = parseFloat(backtestData[candle][6]);
                this.candtrades = parseFloat(backtestData[candle][7]);
            }
            if (this.apiType == 'td') {
                    let dat = backtestData[candle];
                    // change this later if need be
                    // TODO: make sure timestamps are in same units!!
                    this.candts = dat.datetime / 1000;
                    this.candopen = dat.open;
                    this.candhigh = dat.high;
                    this.candlow = dat.low;
                    this.candclose = dat.close;
                    this.candvol = dat.volume;
                    this.candtrades = null;
            }//else if apitype....
            this.parsedDat.push(qm.CreateCandlestick(this.candts, this.candopen, this.candhigh, this.candlow, this.candclose, this.candvol, this.candtrades));
        }

    }

    /// We call this when new data is loaded
    InitData(exchange, backtestData) {
        // 'kraken', etc
        this.apiType = exchange;
        // moving this.graphdat out of here and only into graph.js.
        /*
        this.graphDat = { // used to be passed in to initdata. i still dont understand graphdat - if its saving to tempstrat why do we reset it every data get??
            chartNumber: this.chartIndex,
            element: document.getElementById('graph' + this.chartIndex),
            topPadding: 10,
            botPadding: 40
        };*/
        // this is what the list will look like
        //[{'timestamp':5854239, 'open': "0.004", 'etc': 'ya'}]
        this.parsedDat = [];
        //add color data here
        this.upperChartIndicatorData = [];
        this.lowerChartIndicatorData = []; // add this. make sure indexing works between both or deleting will fuck some shit up

        if (exchange == "none")
        {
            this.parsedDat = backtestData;
        }
        else
        {
            this.ParseAPIData(backtestData);
        }

        // TODO: maybe in the future allow the zoom to be bigger than dataset
        let zom = 25;
        if (this.parsedDat.length <= zom) {
            zom = this.parsedDat.length - 1;
        }
        //if (exchange != "none") // we loading massive data lol
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

        //console.log("TEMPRSTRAT INDICATORS LEN:" + tempStrat.indicators.length);
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
        //console.log(afterHoursDat);

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
        let indDatIndex = 0;
        switch (obj.type) {
            case 'math':
                return this.EvalMathObject(obj.params.mathObject);
            case 'constant':
                return obj.params.value;
            case 'price':
                return this.parsedDat[this.stratIndex - obj.params.index][obj.params.ohlc];
            case 'buy-price':
                if (this.boughtIndexes.length == 0) return 'no';
                // TODO: should we just keep the close here? no
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
            case 'BOL':
                //let indx = GetRelevantChartIndex(Number(obj.tsId));
                //let indicator = tempStrat.indicators[Number(obj.tsId)];
                switch (obj.params.band)
                {
                    case 'upper band':
                        indDatIndex = 1;
                        break;
                    case 'lower band':
                        indDatIndex = 2;
                        break;

                }
                break;

        }
        // it's an indicator. we have the index
        let indx = GetRelevantChartIndex(Number(obj.tsId));
        let indicator = tempStrat.indicators[Number(obj.tsId)];
        // console.log(obj);
        // console.log(this.stratIndex - obj.params.index);
        console.log(indicator.params.period);
        if (indicator.params.hasOwnProperty('period') && this.stratIndex - obj.params.index < indicator.params.period - 1)
            return 'no';
        console.log(this.upperChartIndicatorData[indx[0]].data[indDatIndex][this.stratIndex - obj.params.index]);
        if (IndicatorIsUpperChart(indicator.type))
        {
            return this.upperChartIndicatorData[indx[0]].data[indDatIndex][this.stratIndex - obj.params.index];
        }
        else
        {
            return this.lowerChartIndicatorData[indx[1]].data[indDatIndex][this.stratIndex - obj.params.index];
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
        //console.log('buystratbp:', tempStrat.buyStratBP);
        //console.log('sellstratbp:', tempStrat.sellStratBP);

        this.buyIndexList = [];
        this.sellIndexList = [];
        // parse blueprint here and when a var change is submitted
        buyStratComparisons = ParseStratBlueprint(tempStrat.buyStratBP);
        sellStratComparisons = ParseStratBlueprint(tempStrat.sellStratBP);

        console.log('buystratcomp');
        console.log(buyStratComparisons);
        console.log('tempstratbp:')
        console.log(tempStrat.buyStratBP)

        if (calcbuy || calcsell) {
            let buying = this.startWithBuy;
            let valToAdd;
            for (this.stratIndex = 0; this.stratIndex < this.parsedDat.length; this.stratIndex++) {
                // if we can't trade outside market hours, check if we are in or outside market hours
                if (tempStrat.noAfterHours) {
                    //console.log(this.upperChartMiscData);
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
    UpdateIndicatorDat(indx = null, removing = null) {
        /**
         * indx is the index of indicator in tempStrat.indicators
         * removing is [bool (upper or lower), [upperchartinddat index, lowerchartind index]]
         */
        // check if ind is upper/lower
        // calculate index of ind's chartinddata
        // if removing, splice. else, calculate shit - uidstuff will have to deal with everything if indx is null - thats in there bc we calcing all in one loop
        if (removing != null)
        {
            if (removing[0]) // it's in upperchart 
            {
                this.upperChartIndicatorData.splice(removing[1][0], 1);
            }
            else
            {
                this.lowerChartIndicatorData.splice(removing[1][1], 1);
            }
            // update references to tempstrat.indicators
            // every indicator after the one deleted in tempstrat
            // needs to decrement their index ref
            for (let i = removing[1][0]; i < this.upperChartIndicatorData.length; i++)
            {
                this.upperChartIndicatorData[i].tsIndex--;
            }
            for (let i = removing[1][1]; i < this.lowerChartIndicatorData.length; i++)
            {
                this.lowerChartIndicatorData[i].tsIndex--;
            }
            console.log("deleted indicator. upperchartinddat and lower:");
            console.log(this.upperChartIndicatorData);
            console.log(this.lowerChartIndicatorData);
        }
        else 
        {
            this.UIDStuff(indx); // uid stuff will do same calcs to find new index
        }

        // if myGraph is already drawn, we need to update it
        if (this.myGraph && drawingStrat) {
            this.myGraph.DrawChart();
        }
    }
    UIDStuff(index) {
        /**
         * Iterates through parsed data, calculating indicator values
         * TODO update multiple indicators at the same time?
         * also could maybe do this part in c++ for faster
         */
        let processingIndicators = [];
        if (index == null) // update all of them
        {
            // make a list with objects for each indicator to store all this data 
            // initialize all indicators
            // loop through all indicators
            // finalize
            for (let i = 0; i < tempStrat.indicators.length; i++)
            {
                // check if ind is upper or lower
                // get its index and save it for later
                let up_low = GetRelevantChartIndex(i);
                if (IndicatorIsUpperChart(tempStrat.indicators[i].type))
                {
                    processingIndicators.push(this.UIDInitIndicator(tempStrat.indicators[i].type, up_low[0], i));
                }
                else
                {
                    processingIndicators.push(this.UIDInitIndicator(tempStrat.indicators[i].type, up_low[1], i));

                }
            }
            
        }
        else
        {
            // add initind index param
            let up_low = GetRelevantChartIndex(index);
            if (IndicatorIsUpperChart(tempStrat.indicators[index].type))
            {
                processingIndicators = [this.UIDInitIndicator(tempStrat.indicators[index].type, up_low[0], index)];
            }
            else
            {
                processingIndicators = [this.UIDInitIndicator(tempStrat.indicators[index].type, up_low[1], index)];
            }
        }
        /*
        console.log(index);
        let finishedList = [];
        console.log(tempStrat.indicators);*/
        for (let p = 0; p < this.parsedDat.length; p++)
        {
            for (let i = 0; i < processingIndicators.length; i++)
            {
                if (index == null)
                    this.UIDStuffTick(i, processingIndicators[i], p);
                else
                    this.UIDStuffTick(index, processingIndicators[0], p);
            }
        }
        /*
        switch (tempStrat.indicators[index].type) {
            case 'MA':
                // initialize
                let tempDatList = [];
                let periodList = [];

                // loop
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

                // after loop
                finishedList = tempDatList;

                break;
            case 'EMA':
                // initializing
                let smaList = [];
                let smaPeriodList = [];
                // first calc sma
                for (let p = 0; p < this.parsedDat.length; p++) {
                    // edit whether it uses open vs close etc this.parsedDat[p]["open"] <- switch to a var
                    smaPeriodList.push(this.parsedDat[p].close);
                    // TODO updating all indicators - where will we get index from
                    // (for each EMA indicator in strategy: and feed index in)
                    if (smaPeriodList.length == tempStrat.indicators[index].params.period) {

                    }
                }
                break;
            default:
                break;
        }
        // i think index will always be included or one after the last in upperchartinddat
        this.upperChartIndicatorData[index] = finishedList;
        */
        if (index == null)
        {
            for (let i = 0; i < processingIndicators.length; i++)
            {
                this.UIDSaveIndicator(processingIndicators[i], i);
            }
        }
        else
        {
            this.UIDSaveIndicator(processingIndicators[0], index);

        }

    }
    UIDSaveIndicator(indData, index)
    {
        /**
         * indData is the object for the indicator info
         */
        let IND_DAT = tempStrat.indicators[index];
        let final = {tsIndex: indData.tempStratInd};
        switch (IND_DAT.type)
        {
            case 'MA':
                final.data = [indData.tempDatList];
                break;
            case 'EMA':
                break;
            case 'BOL':
                final.data = [indData.tempDatList, indData.BOLUList, indData.BOLDList];
                console.log(final.data);
                break;
            //###############LOWER CHART####################
            case 'VOL':
                final.data = [indData.volList];
                break;
            default:
                break;
        }
        if (IndicatorIsUpperChart(IND_DAT.type))
        {
            this.upperChartIndicatorData[GetRelevantChartIndex(index)[0]] = final;
        }
        else
        {
            this.lowerChartIndicatorData[GetRelevantChartIndex(index)[1]] = final;
        }
    }
    UIDInitIndicator(indType, cIndex, tsIndex)
    {
        let indObj = {chartIndex: cIndex, tempStratInd: tsIndex};
        switch (indType)
        {
            case 'MA':
                indObj.tempDatList = [];
                indObj.periodList = [];
                break;
            case 'EMA':
                indObj.smaList = [];
                indObj.smaPeriodList = [];
                break;
            case 'VOL':
                indObj.volList = [];
                break;
            case 'BOL':
                indObj.tempDatList = []; // sma
                indObj.periodList = []; // sma
                indObj.BOLUList = []; // upper band
                indObj.BOLDList = []; // lower
                break;
            default:
                break;
        }
        return indObj;
    }
    UIDStuffTick(tempStratIndex, myObject, pos)
    {
        function CalcSMA(self, periodList, tempDatList, ohlc, period)
        {
            if (ohlc == "TP") // typical price
            {
                periodList.push((self.parsedDat[pos].high + self.parsedDat[pos].low + self.parsedDat[pos].close) / 3);
            }
            else
            {
                periodList.push(self.parsedDat[pos][ohlc]);

            }
            if (periodList.length == period) //TODO ERROR CHECK bro this was just at period.
            {
                tempDatList.push(periodList.reduce((a, b) => a + b, 0) / periodList.length);
                periodList.shift();
            }
            else
            {
                tempDatList.push(null);
            }
        }
        let INDICATOR_DAT = tempStrat.indicators[tempStratIndex];
        switch (INDICATOR_DAT.type)
        {
            case 'MA':
                // TODO: if you want to edit whether it uses open v close etc add here
                CalcSMA(this, myObject.periodList, myObject.tempDatList, 'close', INDICATOR_DAT.params.period);
                /*
                myObject.periodList.push(this.parsedDat[pos].close);
                if (myObject.periodList.length == INDICATOR_DAT.params.period)
                {
                    myObject.tempDatList.push(myObject.periodList.reduce((a, b) => a + b, 0) / myObject.periodList.length);
                    // remove first item
                    myObject.periodList.shift();
                } else {
                    myObject.tempDatList.push(null);
                }*/
                
                break;
            case 'EMA':
                break;
            case 'BOL':
                CalcSMA(this, myObject.periodList, myObject.tempDatList, 'TP', INDICATOR_DAT.params.period);
                console.log(myObject.periodList.length, INDICATOR_DAT.params.period);
                if (myObject.periodList.length != INDICATOR_DAT.params.period - 1) // TODO CHECK -1 ??
                {
                    myObject.BOLUList.push(null);
                    myObject.BOLDList.push(null);
                    break;
                }
                //console.log(myObject.periodList);
                // variance
                let mean = myObject.periodList.reduce((a, b) => a + b, 0) / myObject.periodList.length;
                let variance = myObject.periodList.reduce((a, b) => a + (b - mean) ** 2) / myObject.periodList.length;
                let std = Math.sqrt(variance);
                //console.log(mean)
                //console.log(variance);
                //console.log(std);

                myObject.BOLUList.push(myObject.tempDatList[myObject.tempDatList.length - 1] + INDICATOR_DAT.params.m * std);
                myObject.BOLDList.push(myObject.tempDatList[myObject.tempDatList.length - 1] - INDICATOR_DAT.params.m * std);
                break;

            //#################LOWER CHART####################
            case 'VOL':
                myObject.volList.push(this.parsedDat[pos].volume);
                break;
        }
    }
    /// from current viewable sticks
    // TODO: include upperchartindicator values in high and low
    // if graph is zooming out - only need to check against high and low with new indices
    // etc. so we don't call a bigass loop every update
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
    HasLowerIndicators()
    {
        return this.lowerChartIndicatorData.length > 0;
    }
}

function IndicatorIsUpperChart(indType)
{
    // there's gotta b a faster way than run this in a loop
    switch(indType)
    {
        // UPPER
        case 'MA':
        case 'EMA':
        case 'BOL':
            return true;
        // lower
        default:
            return false;
    }
}
function GetRelevantChartIndex(tempStratIndex)
{
    //console.log('TEMPSTRAT INDEX: ' + tempStratIndex);
    let IND_LIST = tempStrat.indicators;
    let upperCount = 0;
    let lowerCount = 0;
    for (let i = 0; i < tempStratIndex; i++) // iterating b4 we hit the thing
    {
        if (IndicatorIsUpperChart(IND_LIST[i].type))
        {
            upperCount++;
        }
        else
        {
            lowerCount++;
        }
    }
    return [upperCount, lowerCount];
}

module.exports = { Chart, IndicatorIsUpperChart, GetRelevantChartIndex }