class Graph {
    constructor(linktChart) {
        this.SLIDER_MAX = 1000;
        //linktChart is a chart class instance
        this.linkedChart = linktChart;
        this.graphDat = this.GenerateGraphData();
        this.canv = this.graphDat.element;


        this.gridDatWidth = 60;
        this.clickString = "";
        this.clickIndex = -1;

        //this.graphDat = this.linkedChart.graphDat;
        //this.dynWinDat = this.linkedChart.dynChartWindowData;
        this.options = {
            prices: true,
            drawingClickData: true
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
        };

        this.scroller.oninput = function() {
            if (Math.round(this.value) == linktChart.dynChartWindowData.shift || !drawingStrat) return;
            linktChart.dynChartWindowData.shift = Math.round(this.value);
            linktChart.dynChartWindowData.lastIndex = linktChart.parsedDat.length - 1 + Math.round(this.value);
            linktChart.myGraph.DrawChart();
        };
        // mouse shit
        this.mouseOn = false;
        this.canv.onmousemove = (e) => this.MouseMove(e);
        this.canv.onmouseleave = () => {
            this.mouseOn = false;
        };
        this.scrlr = this.scroller; // bro wtf some fuckin bullshit this.scroller is getting converted to some shitty string so i have to do this
        this.canv.addEventListener('wheel', evt => this.ScrollerTest.call(this, evt));

        this.canv.onmousedown = (e) => this.MouseClicked(e);

        this.ComputeWidth();
    }
    ScrollerTest(e)
    {
        let val = 0;
        if (e.deltaX < 0)
            val = -1;
        else if (e.deltaX > 0)
            val = 1;
        if (val == 0) return;
        //console.log(val);
        var event = new Event('input');
        // console.log(this.scrlr.value);
        // console.log(this.scrlr.min);
        // FOR SOME FUCKING BULLSHIT REASON YOU HAVE TO DO -= -VAL WHAT THE ACTUAL FUCK
        this.scrlr.value -= -e.deltaX;
        this.scrlr.dispatchEvent(event);

    }
    GenerateGraphData()
    {
        return  {
            chartNumber: this.linkedChart.chartIndex,
            element: document.getElementById('graph' + this.linkedChart.chartIndex),
            topPadding: 10,
            botPadding: 40,
            lowerChartHeight: 100,
            clickDataWidth: 180
        }
    }
    CalibrateSliders() {
        /**
         * 
         */
        //first zoom slider

        this.slider.min = 0;
        if (this.linkedChart.parsedDat.length < this.SLIDER_MAX)
            this.slider.max = this.linkedChart.parsedDat.length - 1;
        else
            this.slider.max = this.SLIDER_MAX;
        //console.log('data length:' + (this.linkedChart.parsedDat.length - 1))
        this.slider.value = this.linkedChart.dynChartWindowData.zoom;
        // then scroller
        this.scroller.min = 0 - (this.linkedChart.dynChartWindowData.lastIndex - this.linkedChart.dynChartWindowData.zoom);
        this.scroller.max = 0;
        this.scroller.value = 0;

    }
    ComputeWidth() {
        this.availableWidth = this.canv.width;
        this.startingXPos = 0;
        if (this.options.prices) {
            this.availableWidth -= this.gridDatWidth;
        }
        if (this.options.drawingClickData && this.clickIndex >= 0)
            this.availableWidth -= this.graphDat.clickDataWidth;
        this.availableWidth -= (this.startingXPos);
    }
    DrawChart() {
        // TODO optimize this func by not having as many var mem allocations
        var firstInd = this.linkedChart.dynChartWindowData.lastIndex - this.linkedChart.dynChartWindowData.zoom;
        var hl = this.linkedChart.GetHighAndLow();
        this.high = hl[0];
        this.low = hl[1];
        this.lowScale = 0;

        var availableSpace = this.canv.height - (this.graphDat.botPadding + this.graphDat.topPadding);
        if (this.linkedChart.HasLowerIndicators())
        {
            availableSpace -= this.graphDat.lowerChartHeight;
        }

        this.scale = availableSpace / (this.high - this.low);
        // TODO: possible optimization: only call computewidth when needed

        //this.ComputeWidth();
        this.indexlength = this.linkedChart.dynChartWindowData.lastIndex - firstInd + 1;
        this.xscale = this.availableWidth / this.indexlength;
        this.indexCount = 0;


        if (this.canv.getContext) {
            this.ctx = this.canv.getContext('2d');
        }
        this.ctx.clearRect(0, 0, this.canv.width, this.canv.height);
        this.DrawGridLines();

        if (this.linkedChart.apiType != "none")
            this.DrawAfterHours(firstInd);
        

        // Draw candlesticks
        for (var j = firstInd; j <= this.linkedChart.dynChartWindowData.lastIndex; j++) {
            this.DrawCandlestick(j);
            this.indexCount += 1;
        }
        this.indexCount = 0;

        // Draw indicators
        let upperChartDat = this.linkedChart.upperChartIndicatorData;
        let indData;
        for (let n = 0; n < upperChartDat.length; n++) {
            indData = upperChartDat[n].data;
            let loopAmt = indData.length;
            // Set color
            this.ctx.strokeStyle = tempStrat.indicators[upperChartDat[n].tsIndex].params.color;
            for (let x = 0; x < loopAmt; x++)
            {
                for (var j = firstInd; j <= this.linkedChart.dynChartWindowData.lastIndex; j++) {
                    this.DrawUpperIndicatorLine(n, x, j);
                    this.indexCount += 1;
                    // If there is a value past the chart, we can draw the last line to it
                    if (j == this.linkedChart.dynChartWindowData.lastIndex && j < indData.length - 1) {
                        this.DrawUpperIndicatorLine(n, x, j + 1);
                    }
                }
                this.indexCount = 0;
            }

        }
        // lower indicators
        if (this.linkedChart.HasLowerIndicators()) //protecc the heap
            this.DrawLowerChart();

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
        // mouse
        if (this.mouseOn)
            this.DrawMouseOver();
        // clicked
        this.DrawClicked();

    }
    DrawLowerChart()
    {
        // draw line
        this.DrawLowerBox();
        let lcd;
        let indData;
        for (let i = 0; i < this.linkedChart.lowerChartIndicatorData.length; i++)
        {
            lcd = this.linkedChart.lowerChartIndicatorData[i];
            this.ctx.strokeStyle = tempStrat.indicators[lcd.tsIndex].params.color;
            let dat = lcd.data[0];
            switch(tempStrat.indicators[lcd.tsIndex].type)
            {
                case "VOL":
                    // first get highest
                    
                    let firstInd = this.linkedChart.dynChartWindowData.lastIndex - this.linkedChart.dynChartWindowData.zoom;
                    let high = dat[firstInd];
                    let low = dat[firstInd];
                    for (let j = firstInd + 1; j <= this.linkedChart.dynChartWindowData.lastIndex; j++)
                    {
                        if (dat[j] > high)
                            high = dat[j];
                        else if (dat[j] < low)
                            low = dat[j];
                    }
                    this.lowScale = this.graphDat.lowerChartHeight / (high - low);
                    for (let j = firstInd; j <= this.linkedChart.dynChartWindowData.lastIndex; j++)
                    {
                        this.DrawLowerIndicatorLine(i, 0, j, high, low);
                        this.indexCount++;
                        // If there is a value past the chart, we can draw the last line to it
                        if (j == this.linkedChart.dynChartWindowData.lastIndex && j < dat.length - 1) {
                            this.DrawLowerIndicatorLine(i, 0, j + 1, high, low);
                        }
                    }
                    this.indexCount = 0;
                    break;
            }

        }
    }
    DrawLowerIndicatorLine(indicatorIndex, datIndex, ind, high, low) {
        //skip if it's the first one
        if (ind == 0 || this.linkedChart.lowerChartIndicatorData[indicatorIndex].data[datIndex][ind - 1] == null) return;
        let val = this.linkedChart.lowerChartIndicatorData[indicatorIndex].data[datIndex][ind];
        let prev = this.linkedChart.lowerChartIndicatorData[indicatorIndex].data[datIndex][ind - 1];
        this.ctx.beginPath();
        this.ctx.moveTo((this.indexCount - 1) * this.xscale + this.xscale / 2 + this.startingXPos, (high - prev) * this.lowScale + (this.canv.height - this.graphDat.lowerChartHeight));
        this.ctx.lineTo(this.indexCount * this.xscale + this.xscale / 2 + this.startingXPos, (high - val) * this.lowScale + (this.canv.height - this.graphDat.lowerChartHeight));
        this.ctx.stroke();
    }
    DrawLowerBox()
    {
        this.ctx.fillStyle = "#e0e7ec";
        this.ctx.beginPath();
        this.ctx.fillRect(0, this.canv.height - this.graphDat.lowerChartHeight, this.canv.width, this.graphDat.lowerChartHeight)
        // this.ctx.moveTo(0, this.canv.height - this.graphDat.lowerChartHeight);
        // this.ctx.lineTo(this.canv.width, this.canv.height - this.graphDat.lowerChartHeight);
        // this.ctx.stroke();
    }
    DrawAfterHours(firstInd)
    {
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
            let y_val;
            for (var i = lConstraint; i <= hConstraint; i += increment) {
                y_val = (this.high - i) * this.scale + this.graphDat.topPadding;
                this.gridLineDat.push(i);
                this.ctx.beginPath();
                this.ctx.moveTo(this.startingXPos, y_val);
                this.ctx.lineTo(this.startingXPos + this.availableWidth, y_val);
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
        function GetDecimalDigits(num)
        {
            if (Number.isInteger(num))
                return 0;
            return num.toString().split('.')[1].length;
        }
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(this.canv.width - this.endingXPadding, 0, this.endingXPadding, this.canv.height);
        // now the text
        this.ctx.fillStyle = 'black';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '12px arial';
        this.ctx.textAlign = 'left';
        let y_val;
        let dd;
        for (let v = 0; v < this.gridLineDat.length; v++) {
            dd = GetDecimalDigits(this.gridLineDat[v]) > 8;
            y_val = (this.high - this.gridLineDat[v]) * this.scale + this.graphDat.topPadding;
            if (dd)
            {
                this.ctx.fillText(this.gridLineDat[v].toString().slice(0, 8 - dd), this.availableWidth, y_val, this.gridDatWidth);
                continue;
            }
            this.ctx.fillText(this.gridLineDat[v], this.availableWidth, y_val, this.gridDatWidth);
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
        let offset = 0;
        if (this.linkedChart.HasLowerIndicators())
            offset += this.graphDat.lowerChartHeight;
        this.ctx.strokeStyle = 'rgb(100, 100, 100)';
        let xpos = this.indexCount * this.xscale + this.startingXPos;
        this.ctx.beginPath();
        this.ctx.moveTo(xpos, 0);
        this.ctx.lineTo(xpos, this.canv.height - (this.graphDat.botPadding + offset));
        this.ctx.stroke();
        let date = new Date(this.linkedChart.parsedDat[bigIndex].timestamp * 1000);
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let year = date.getFullYear();
        let dateString = month + '/' + day + '/' + year;
        this.ctx.fillStyle = 'blue';
        this.ctx.textAlign = 'center';
        this.ctx.font = '12px arial';
        this.ctx.fillText(dateString, xpos, this.canv.height - (this.graphDat.botPadding / 2 + offset));
    }
    DrawPrePostMarket(startPos, endPos) {
        // called on every candle because apparently there are fucking random skips
        // in the stock market like 4:30am to 5am and shit
        this.ctx.fillStyle = 'rgba(200, 200, 220, .3)';
        if (startPos >= this.availableWidth) return;
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
    DrawUpperIndicatorLine(indicatorIndex, dataIndex, ind) {
        //skip if it's the first one
        let dat = this.linkedChart.upperChartIndicatorData[indicatorIndex].data[dataIndex];
        if (ind == 0 || dat[ind - 1] == null) return;
        let val = dat[ind];
        let prev = dat[ind - 1];
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
    CheckInGraphXBounds(x)
    {
        return x <= this.availableWidth;
    }
    DrawMouseOver()
    {
        this.ctx.strokeStyle = "rgba(0, 0, 0, .2)";
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.mousePos[1]);
        this.ctx.lineTo(this.availableWidth, this.mousePos[1]);
        this.ctx.moveTo(this.mousePos[0], 0);
        this.ctx.lineTo(this.mousePos[0], this.canv.height);
        this.ctx.stroke();
    }
    DrawClicked()
    {
        if (this.clickIndex == -1) return;
        this.DrawClickData();
        let x = (this.clickIndex - (this.linkedChart.dynChartWindowData.lastIndex - this.linkedChart.dynChartWindowData.zoom)) * this.xscale + this.xscale / 2 + this.startingXPos;
        if (x < 0 || x > this.availableWidth) return;
        let y_pos = (this.high - this.linkedChart.parsedDat[this.clickIndex].close) * this.scale + this.graphDat.topPadding;
        this.ctx.strokeStyle = "black";
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canv.height);
        // now for price
        this.ctx.moveTo(0, y_pos);
        this.ctx.lineTo(this.availableWidth, y_pos);

        this.ctx.stroke();
        let font_size = 13;
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(this.availableWidth, y_pos - font_size / 2, this.gridDatWidth, font_size);
        this.ctx.fillStyle = 'maroon';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = font_size + 'px arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.linkedChart.parsedDat[this.clickIndex].close, this.availableWidth, y_pos);
    }
    DrawClickData()
    {
        let font_size = 15;
        let myCurX = this.availableWidth + this.gridDatWidth;
        let myCurY = 0;
        this.ctx.fillStyle = 'black';
        this.ctx.textBaseline = 'top';
        this.ctx.font = font_size + 'px arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText("Clicked Data:", myCurX, 0, this.clickDataWidth);
        myCurY += font_size;
        this.ctx.fillText("Timestamp: " + this.linkedChart.parsedDat[this.clickIndex].timestamp, myCurX, myCurY, this.clickDataWidth);
        myCurY += font_size;
        let tim = new Date(this.linkedChart.parsedDat[this.clickIndex].timestamp * 1000);
        tim = tim.toLocaleString('en-US', {timeZone: 'America/New_York'});//.split(", ")[1].split(" ");
        this.ctx.fillText(tim, myCurX, myCurY, this.clickDataWidth);
        myCurY += font_size;
        let stri;
        let tsObj;
        for (let i = 0; i < this.linkedChart.upperChartIndicatorData.length; i++)
        {
            tsObj = tempStrat.indicators[this.linkedChart.upperChartIndicatorData[i].tsIndex];
            stri = tsObj.type;
            if (Object.hasOwn(tsObj.params, "period"))
                stri += tsObj.params.period;
            stri += ": ";
            stri += this.linkedChart.upperChartIndicatorData[i].data[0][this.clickIndex];
            this.ctx.fillText(stri, myCurX, myCurY, this.clickDataWidth);
            myCurY += font_size;
        }
        myCurY += font_size; // separate w/ newline
        for (let i = 0; i < this.linkedChart.lowerChartIndicatorData.length; i++)
        {
            tsObj = tempStrat.indicators[this.linkedChart.lowerChartIndicatorData[i].tsIndex];
            stri = tsObj.type;
            if (Object.hasOwn(tsObj.params, "period"))
                stri += tsObj.params.period;
            stri += ": ";
            stri += this.linkedChart.lowerChartIndicatorData[i].data[0][this.clickIndex];
            this.ctx.fillText(stri, myCurX, myCurY, this.clickDataWidth);
            myCurY += font_size;
        }
    }
    GenerateClickStringLine()
    {
        
    }

    MouseMove(e)
    {
        // ignoring canvas border for now
        let rect = this.canv.getBoundingClientRect();
        let compStyle = parseInt(window.getComputedStyle(this.canv).borderBlockWidth);
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        this.mousePos = [x, y];
        // update a shitload
        this.mouseOn = true;
        this.DrawChart();
    }
    MouseClicked(e)
    {
        let rect = this.canv.getBoundingClientRect();
        let x = e.clientX - rect.left;
        if (!this.CheckInGraphXBounds(x)) return;
        let y = e.clientY - rect.top;
        let cIndex = (x - this.xscale / 2 - this.startingXPos) / this.xscale; // reverse engineering above eqn
        cIndex = Math.round(cIndex) + (this.linkedChart.dynChartWindowData.lastIndex - this.linkedChart.dynChartWindowData.zoom); // first ind in draw loop
        if (cIndex >= this.linkedChart.parsedDat.length || cIndex < 0) return; // we clicked outta bounds
        if (this.clickIndex == -1) // we need to adjust zoom
        {
            console.log(this.slider.value)  
            this.slider.value -= -Math.round(this.graphDat.clickDataWidth / this.xscale - 1)
            console.log(Math.round(this.graphDat.clickDataWidth / this.xscale))
            let event = new Event('input');
            this.slider.dispatchEvent(event);
        }
        this.clickIndex = cIndex;
        this.ComputeWidth();
        this.DrawChart();
    }
}
module.exports = { Graph };