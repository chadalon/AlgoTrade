function ParseCandleInterval(intvl) // intvl format : "30 minute" etc
{
    let intervalType = intvl.split(" ")[1];
    let intervalNum = parseInt(intvl.split(" ")[0]);

    if (intervalType == 'hours') {
        intervalNum *= 60;
        intervalType = 'minute';
    }
    return [intervalNum, intervalType];
}
function CreateCandlestick(ts, o, h, l, c, vol, trads)
{
    return {
        timestamp: ts,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: vol,
        trades: trads
    }
}
module.exports = { ParseCandleInterval, CreateCandlestick }