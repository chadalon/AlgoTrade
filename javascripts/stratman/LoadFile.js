// TODO make a container div w/ load file button
// and a "Current file: AAXEVE.csv" 
// and of course add this to tempstrat
// don't delete ref when token is changed --
// if we wanna come back to offline we'll have it remember file

// options to add:
// load folder
// load all with the same file ?
// make this a class so we can just re-assign chart index?
// only problem I see is it would bloat program more
const FileDecoder = require("./FileDecoder.js");
class FileLoader {
    constructor(chartIndex)
    {
        this.chartIndex = chartIndex;
        if (!this.GetMyTempObject().hasOwnProperty("linkedFile")) // If we're creating a new obj, set tempstrat with linkedfile
        {
            this.GetMyTempObject().linkedFile = null;
        }

        this.file = this.GetMyTempObject().linkedFile; // for loading, all creator funcs will check if this is null

        this.fileLabel = document.createElement("p");
        if (this.file == null)
        {
            this.runBut = null;
        }
        else
        {
            this.runBut = this.MakeRunResultsButton();
            this.fileLabel.innerText = this.file.name;
        }
        this.mainElement = this.MakeLFDiv();
        
    }
    GetMyTempObject()
    {
        return tempStrat.charts[this.chartIndex];
    }
    Load()
    {
        // make a button to run results
        // taken from https://stackoverflow.com/questions/16215771/how-to-open-select-file-dialog-via-js
        var loader = document.createElement('input');
        loader.type = 'file';

        loader.onchange = e => { 
            // TODO CLEAR GRAPH IF WE REPLACED ONE

            // getting a hold of the file reference
            var file = e.target.files[0]; 

            // setting up the reader
            var reader = new FileReader();
            reader.readAsText(file,'UTF-8');

            // here we tell the reader what to do when it's done reading...
            reader.onload = readerEvent => {
                this.fileLabel.innerText = file.name;
                var content = readerEvent.target.result; // this is the content!
                // TODO save to tempstrat
                // and enable loading in data
                this.file = file;
                this.runBut = this.MakeRunResultsButton();
                if (this.mainElement.childNodes.length < 3)
                    this.mainElement.appendChild(this.runBut);
            }
        }

        loader.click();
    }
    DetermineFileFormat()
    {
        // TODO make this func
        return "tpa"; // timestamp, price, amt
    }
    Run()
    {
        this.GetMyTempObject().linkedFile = {name: this.file.name, path: this.file.path, format: this.DetermineFileFormat()};
        UpdateStratFileAndGraph(); // we wanna save this change to the temp file
        this.RunningFeedback();
        let fd = new FileDecoder.FileDecoder(this);
    }
    RunningFeedback()
    {
        let ploob = document.createElement("p");
        ploob.innerText = "Running...";

        this.mainElement.appendChild(ploob);

    }
    StopFeedback()
    {
        console.log(this.mainElement.childNodes);
        for (let elem = 0; elem < this.mainElement.childNodes.length; elem++)
        {
            let thing = this.mainElement.childNodes[elem];
            if (thing.innerText == "Running...")
            {
                thing.remove();
            }
        }
    }
    MakeRunResultsButton() 
    {
        let runit = document.createElement("button");
        runit.innerHTML = "Run file";
        runit.addEventListener("click", this.Run.bind(this));
        return runit;
    }
    MakeLFButton()
    {
        let loadFile = document.createElement("button");
        loadFile.innerHTML = "Load File";
        loadFile.addEventListener("click", this.Load.bind(this));
        return loadFile;
        
    }
    MakeLFDiv()
    {
        let container = document.createElement("div");
        container.id = "loadFile" + this.chartIndex;
        let loadBut = this.MakeLFButton();

        container.append(this.fileLabel);
        container.appendChild(loadBut);
        if (this.runBut != null) {
            container.appendChild(this.runBut);
        }
        return container;
        // this can be used for the check balances button
        /*
        if (tempStrat.token == "none" && !!!document.getElementById("loadFile")) {
        }
        else if (tempStrat.token != "none" && !!document.getElementById("loadFile")) {
            document.getElementById("loadFile").remove();
        }
        */
    }
}

module.exports = { FileLoader };