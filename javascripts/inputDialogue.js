const electron = require('electron');
const {ipcRenderer} = electron;
const querystring = require('querystring');

const stratName = document.getElementById('name');
let query = querystring.parse(global.location.search);
stratName.value = query['?name'];

const nameForm = document.getElementById('form');
nameForm.addEventListener('submit', SubmitName);

function SubmitName(e) {
    e.preventDefault();
    if (stratName.value == '') {
        alert('Please enter a value.');
        return;
    }
    else if (stratName.value == 'New') {
        alert('Sorry I already claimed "New". try again');
        return;
    }
    ipcRenderer.send("ID:submitName", stratName.value);
    window.self.close();
}