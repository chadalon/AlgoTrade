class FileDecoder {
    constructor(linkedLFObj)
    {
        // Lots of memory usage here
        this.linkedLF = linkedLFObj;
        this.name = linkedLFObj.file.name;
        this.path = linkedLFObj.file.path;
        this.format = linkedLFObj.DetermineFileFormat();
        let interv = qm.ParseCandleInterval(chartList[linkedLFObj.chartIndex].chartInterval); // make sure we update when this changes
        this.intervalNum = interv[0];
        this.intervalType = interv[1];
        //if (this.intervalType == "minute")
        this.MULT_FACTOR = 60;
        if (this.intervalType == "hour")
        {
            this.intervalNum *= 60; // switching to minutes
        }
            
        // TODO finish!^^
        this.data = [];
        this.finalCandles = [];

        fs.createReadStream(this.path).pipe(csv.parse({headers: false})).on('error', error =>
        console.error(error)).on('data', row => this.data.push(row.map(Number))).on('end', () => this.Parse());
    }
    Parse()
    {
        this.ResetCandleVars();
        for (let i = 0; i < this.data.length; i++)
        {
            // sets member vars for current trade data
            switch (this.format)
            {
                case "tpa": // timestamp, price, amt
                    this.TPA(i);
                    break;
                default:
                    break;
            }

            this.candleTimestamp = this.CalcTS(this.curTradeTimestamp); // if timestamps are equal, update info on current cstick
            if (i == 0)
                this.curTimestamp = this.candleTimestamp;
            let count = 0;
            while (this.candleTimestamp != this.curTimestamp) // skip any empty candles
            {
                count++;
                if (count > 1000)
                {
                    console.log("it's gettin big");
                    console.log("i: " + i);
                    console.log(this.format);
                    console.log(typeof this.candleTimestamp);
                    console.log(this.candleTimestamp);
                    console.log(typeof this.curTradeTimestamp);
                    console.log(this.curTradeTimestamp);
                    console.log(typeof this.curTimestamp);
                    console.log(this.curTimestamp)
                    return;
                    
                }
                //console.log(this.candleTimestamp - this.curTimestamp);
                if (this.candleTimestamp < this.curTimestamp) 
                {
                    console.log("Shit got fucked");
                    console.log(this.candleTimestamp, this.curTimestamp);
                    return;
                }
                this.CloseoutCandle();
                this.curTimestamp += this.MULT_FACTOR * this.intervalNum; // this way we hit each interval. if no data, we can reflect that
                // store in candle
            }
            this.curVolume += this.curAmt;
            if (this.curOpen == 0)
                this.curOpen = this.curPrice;
            if (this.curPrice > this.curHigh)
                this.curHigh = this.curPrice;
            if (this.curLow == 0 || this.curPrice < this.curLow)
                this.curLow = this.curPrice;
            this.curTrades++;
        }
        this.CloseoutCandle();
        chartList[this.linkedLF.chartIndex].InitData('none', this.finalCandles);
        this.linkedLF.StopFeedback();
    }
    CalcTS(timestamp)
    {
        return timestamp - (timestamp % (this.MULT_FACTOR * this.intervalNum));
    }
    CloseoutCandle()
    {
        if (this.curVolume == 0)
        {
            // we didn't hit any. set price to last one
            // TODO YO AM I DOING THIS RIGHT?? JUST SET EVERYTHING TO SAME??
            this.curOpen = this.curPrice;
            this.curHigh = this.curPrice;
            this.curLow = this.curPrice;
            this.curClose = this.curPrice;
        }
        else
        {
            this.curClose = this.curPrice;
        }
        this.finalCandles.push(qm.CreateCandlestick(this.curTimestamp, this.curOpen, this.curHigh, this.curLow, this.curClose, this.curVolume, this.curTrades));
        this.ResetCandleVars();
    }
    ResetCandleVars()
    {
        this.curVolume = 0;
        this.curOpen = 0;
        this.curHigh = 0;
        this.curLow = 0;
        this.curClose = 0;
        this.curTrades = 0;

    }
    TPA(i)
    {
        this.curTradeTimestamp = this.data[i][0];
        this.curPrice = this.data[i][1];
        this.curAmt = this.data[i][2];
    }


}
module.exports = { FileDecoder };