const electron = require('electron');
const {ipcRenderer} = electron;

var apiTokens = {};
const krakenul = document.getElementById('krakenList');
const ameritradeul = document.getElementById('ameritradeList');
const etradeul = document.getElementById('etradeList');

const kForm = document.getElementById('kForm');
kForm.addEventListener('submit', addKraken);

const tdForm = document.getElementById('tdForm');
tdForm.addEventListener('submit', AddTD);

const etForm = document.getElementById("etForm");
etForm.addEventListener('submit', AddEtrade);

const stratButton = document.getElementById('stratButt');
stratButton.addEventListener('click', function(){
    ipcRenderer.send('strat-window');
});

// TODO: possible to delete api tokens
// TODO: encrypt sensitive data files
// TODO: refresh liverun after adding api
// TODO: verify token if possible
// TODO: hide form after submit
function addApiThing(apiType, name, key, sec=null) {
    /*
        This FUN-ction adds an api to the html and data
        for any site. apiType is the site (kraken, td, etc)
        and the function does input verification then adds the 
        data to the program.
    */

    //input verify
    if (name == '' || key == '' || sec != null && sec == '')
    {
        alert('You need to fill out all values.');
        return;
    }
    else if (key.length < 6)
    {
        alert("boi ur key is too smol");
        return;
    }
    else if (sec != null && sec.length < 6)
    {
        alert("ok ur secret is too small dumbass");
        return;
    }

    let tokenList;
    let ulToEdit;
    switch (apiType) {
        case 'kraken':
            tokenList = apiTokens.kraken;
            ulToEdit = krakenul;
            // Clear values
            document.getElementById('kName').value = '';
            document.getElementById('kKey').value = '';
            document.getElementById('kSecret').value = '';
            break;
        case 'td':
            tokenList = apiTokens.td;
            ulToEdit = ameritradeul;
            // Clear values
            document.getElementById('tdName').value = '';
            document.getElementById('tdKey').value = '';
            document.getElementById('tdRefresh').value = '';
            break;
        case 'et':
            tokenList = apiTokens.etrade;
            ulToEdit = etradeul;
            document.getElementById('etName').value = '';
            document.getElementById('etKey').value = '';
            document.getElementById('etSecret').value = '';
            break;
        default:
            alert("API type not on file");
            break;
    }
    if (CheckIfNameExists(tokenList, name)) {
        alert("make an original name bitch");
        return;
    }

    ipcRenderer.send('API:add', apiType, name, key, sec);
    //add li to ul
    const li = document.createElement('li');
    const txt = document.createTextNode(name + "- ..." + key.slice(-4));
    li.appendChild(txt);
    ulToEdit.appendChild(li);
}
function addKraken(e) {
    // Form submit for new Kraken api
    e.preventDefault();
    // names can be the same in diff apis, but not in the same one
    const name = document.getElementById('kName').value;
    const key = document.getElementById('kKey').value;
    const sec = document.getElementById('kSecret').value;

    addApiThing('kraken', name, key, sec);
}

function AddTD(e) {
    // Form submit for TD Ameritrade api
    e.preventDefault();
    // names can be the same in diff apis, but not in the same one
    const name = document.getElementById('tdName').value;
    const key = document.getElementById('tdKey').value;
    const rtoken = document.getElementById('tdRefresh').value;

    addApiThing('td', name, key, rtoken);
}

function AddEtrade(e) {
    e.preventDefault();
    const name = document.getElementById('etName').value;
    const key = document.getElementById('etKey').value;
    const sec = document.getElementById('etSecret').value;

    addApiThing('et', name, key, sec);
}

function CheckIfNameExists(list, nam) {
    for (var tok in list)
    {
        if (list[tok].name == nam) {
            return true;
        }
    }
    return false;
}



ipcRenderer.on('api-data', function(e, dat){
    apiTokens = dat;
});
// Called on page finish load
ipcRenderer.on('updateTokens', function(e, toks){
    //TODO: CHECK IF TOKS ALREADY HAS EVERY POSSIBLE API EVEN IF NO DATA, IF SO REMOVE THE IF TOKS.HASOWNPROPERTY, THATS FUCKEN REDUNDANT AF
    // ^^ removed the hasownproperties, if something's shitting out that's probs it
    apiTokens = toks;
    krakenul.innerHTML = '';
    ameritradeul.innerHTML = '';
    etradeul.innerHTML = '';
    for (var tok in toks.kraken)
    {
        const li = document.createElement('li');
        const txt = document.createTextNode(toks.kraken[tok].name + "- ..." + toks.kraken[tok].key.slice(-4));
        li.appendChild(txt);
        krakenul.appendChild(li);
    }
    
    for (var tok in toks.td)
    {
        const li = document.createElement('li');
        const txt = document.createTextNode(toks.td[tok].name + "- ..." + toks.td[tok].key.slice(-4));
        li.appendChild(txt);
        ameritradeul.appendChild(li);
    }
    
    for (var tok in toks.etrade)
    {
        const li = document.createElement('li');
        const txt = document.createTextNode(toks.etrade[tok].name + "- ..." + toks.etrade[tok].key.slice(-4));
        li.appendChild(txt);
        etradeul.appendChild(li);
    }
    
});