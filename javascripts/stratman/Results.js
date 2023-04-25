//   TODO make a new window for results for now prob
const resDiv = document.getElementById('resData');
function DisplayResults(clear = true)
{
    function DataDiv(name, data)
    {
        let myDiv = document.createElement('li');
        myDiv.innerHTML = name + ': ' + data;
        ul.appendChild(myDiv);
    }
    if (clear)
        resDiv.innerHTML = '';
    let ul = document.createElement("ul");
    for (let j = 0; j < chartList.length; j++)
    {
        let chrt = chartList[j];
        if (!chrt.finishedCalcs) continue;
        DataDiv(chrt.pair, '');
        DataDiv("Final Stock", chrt.tradingStock);
        DataDiv("Final Money", chrt.tradingCash);
        DataDiv("Final Value", chrt.tradingCash + chrt.tradingStock * chrt.parsedDat[chrt.parsedDat.length - 1].close);
        // Beat the market by...
        // Recent vs early performance

    }
    resDiv.appendChild(ul);
}
module.exports = {DisplayResults}