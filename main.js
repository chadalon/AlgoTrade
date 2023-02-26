const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');

const {app, BrowserWindow, Menu, ipcMain} = electron;


//process.env.NODE_ENV = 'production';

const keyPath = './keys.json';
const tempStratPath = './tempStrat.json';
const stratPath = './strategies.json';


var apiList = {};

let dashWindow;
let stratWindow;


// Listen for app to be ready
app.on('ready', function(){
    dashWindow = new BrowserWindow({
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    dashWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'dashboard.html'),
        protocol: 'file:',
        slashes: true
    }));
    
    dashWindow.webContents.on('did-finish-load', function(e) {
        if (fs.existsSync(keyPath)) {
            let rawdata = fs.readFileSync(keyPath);
            let apis = JSON.parse(rawdata);
            apiList = apis;
            dashWindow.webContents.send('updateTokens', apis);
        }
    });

    dashWindow.on('closed', function(){
        app.quit();
    });

    const myMenu = Menu.buildFromTemplate(dashMenu);
    Menu.setApplicationMenu(myMenu);
});


// Launch stratmanager
ipcMain.on('strat-window', function(){
    if (stratWindow) return;
    createStratWindow();
});

function createStratWindow() {
    stratWindow = new BrowserWindow({
        width: 1600,
        height: 950,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });
    stratWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'stratmanager.html'),
        protocol: 'file:',
        slashes: true
    }));

    stratWindow.on('close', function(){
        stratWindow = null;
    });
    ///TODO: move this outta here and make window creation cleaner https://www.electronjs.org/docs/latest/api/window-open
    stratWindow.webContents.setWindowOpenHandler(({url}) => {
        // There's only one url i'm opening with stratman right now - the name input one
        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                frame: false,
                fullscreenable: false,
                width: 300,
                height: 200,
                webPreferences: {
                    contextIsolation: false,
                    nodeIntegration: true
                }
            }
        }
    });

}


/// dat is a dict 
ipcMain.on('currentStrat:updateFile', function(e, tempStrat){
    // write var to file
    OverwriteStrategies(tempStrat, tempStratPath);
});

ipcMain.on('loadTempStrat', function(e) {
    /**
     * Reads tempStrat file and returns an object
     */
    fs.readFile(tempStratPath, (err, data) => {
        if (err) {
            stratWindow.webContents.send('alert', err);
            return;
        }
        if (!data) {
            stratWindow.webContents.send('alert', "Last state does not exist !");
        } else {
            stratWindow.webContents.send('tempStratSuccess', JSON.parse(data));
        }
    });
});

ipcMain.on('give-strat-data', function(e){
    stratWindow.webContents.send('strat-data', ReadStratData(stratPath));
});

ipcMain.on('ID:submitName', function(e, name){
    /**
     * This is when the inputdialogue window submits
     * name info for strategy we're saving.
     */
    
    // read data from tempstrat
    let temporaryStrategy;
    let savedStrategies;
    try {
        temporaryStrategy = ReadStratData(tempStratPath);
    }
    catch (error) {
        console.log(error);
        return;
    }
    if (temporaryStrategy == -1) {
        stratWindow.webContents.send('alert', 'There is no tempStrat data. Abandoning ship...');
        return;
    }
    else {
        // write temporary strategy to saved strategies
        try {
            savedStrategies = ReadStratData(stratPath);
        }
        catch (error) {
            console.log(error);
            return;
        }
        if (savedStrategies == -1) {
            // No saved strat data
            let strats = {
                name: temporaryStrategy
            };
            OverwriteStrategies(strats, stratPath);
        }
        else {
            savedStrategies[name] = temporaryStrategy;
            OverwriteStrategies(savedStrategies, stratPath);
        }
    }

    // Now update the dropdown in stratwindow
    stratWindow.webContents.send('savedStrategy', savedStrategies, name);

});

ipcMain.on('strategies:delete', function(e, strats) {
    OverwriteStrategies(strats, stratPath);
});

function OverwriteStrategies(strats, fPath) {
    /**
     * Takes object and file, and writes that object to file.
     * Here for better ergonomics.
     * ASYNC
     */
    fs.writeFile(fPath, JSON.stringify(strats, null, 2), (err) => {
        if (err) {
            stratWindow.webContents.send('alert', err);
        }
    });
}

function ReadStratData(filePath) {
    /**
     * returns -1 if we can replace the file, otherwise returns
     * parsed data
     */
    if (fs.existsSync(filePath)) {
        let data = fs.readFileSync(filePath);
        if (!data) {
            return -1
        }
        else {
            return JSON.parse(data);
        }
    } else {
        return -1;
    }
}

ipcMain.on('API:add', function(e, apiType, nam, k, sec){
    /**
     * Takes new api data, determines the type of api (kraken, td, etc)
     * with apiType. Updates the tokens in JSON FILE, if the file doesn't
     * exist it creates one with an empty list for each api type (then adds
     * the one submitted). Then it updates the apiList var and related
     * variables in every open window.
     */
    
    let tokenData = {name: nam, key: k, secret: sec};
    /*
    // Rename secret to refresh key if you want, but no need right now
    if (apiType == 'td') {
        tokenData = {name: nam, key: k}
    }
    */

    let apiData = {
        kraken: [],
        td: [],
        et: []
    };

    if (fs.existsSync(keyPath)) {
        // Keys exist
        let rawdata = fs.readFileSync(keyPath);
        apiData = JSON.parse(rawdata);
    }

    // TODO: can i just do apiData[apiType].push(tokenData); ?? instead of switch statement
    switch (apiType) {
        case 'kraken':
            apiData.kraken.push(tokenData);
            break;
        case 'td':
            apiData.td.push(tokenData);
            break;
        case 'et':
            apiData.etrade.push(tokenData);
            break;
        default:
            console.log('APItype coded incorrectly');
            break;
    }
    let data = JSON.stringify(apiData, null, 2);
    fs.writeFileSync(keyPath, data);

    ChangedTokens(apiData);
});
// WHEN ADDING TD SHIT AND DELETING REMEMBER TO CALL CHANGEDTOKENS

function ChangedTokens(newData) {
    /**
     * Updates api list variable in every open script (including this one).
     */
    // TODO: Refresh live run apis
    apiList = newData;
    dashWindow.webContents.send('api-data', apiList);
    if (stratWindow) {
        stratWindow.webContents.send('api-data', apiList);
    }
}

ipcMain.on('give-api-data', function(e){
    stratWindow.webContents.send('api-data', apiList);
});



// Dash menu
const dashMenu = [
    {
        label:'File',
        submenu:[
            {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                click(){
                    app.quit();
                }
            }
        ]
    },
    {
        label: 'APIs',
        submenu:[
            {
                label: 'Add Kraken API' // you need to update all pages when this happens!!!
            }
        ]
    }
];

if(process.platform == 'darwin'){
    dashMenu.unshift({});
}

// Add dev tools item if not in production
if(process.env.NODE_ENV !== 'production'){
    dashMenu.push({
        label: 'Developer Tools',
        submenu:[
            {
                label: 'Toggle DevTools',
                accelerator: 'CmdOrCtrl+I',
                click(item, focusedWindow){
                    focusedWindow.toggleDevTools();
                }
            },
            {
                role: 'reload'
            }
        ]
    });
}