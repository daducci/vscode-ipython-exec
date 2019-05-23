const vscode = require('vscode');
const clipboardy = require('clipboardy');

var activeEditor = vscode.window.activeTextEditor
var terminal = null

// create a decorator type to be used to decorate cell beginning
const cellDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(100,240,100,0.2)',
    color: '#090',
    border: 'solid #090',
    borderWidth: '0 0 2px 0',
    isWholeLine: true
})


function activate(context)
{
	if (activeEditor) updateDecorations()

	vscode.window.onDidChangeActiveTextEditor( editor => {
		    activeEditor = editor
		    if (editor) updateDecorations()
        }, null, context.subscriptions
    )

	vscode.workspace.onDidChangeTextDocument( event => {
		    if (activeEditor && event.document === activeEditor.document) updateDecorations()
        }, null, context.subscriptions
    )

    function updateDecorations() {
        if (!activeEditor) return
        
		const regEx = /^#%%.*$/gm
		const text = activeEditor.document.getText()
		let cellDecorations = []
        let match
        while (match = regEx.exec(text))
        {
			const startPos = activeEditor.document.positionAt(match.index)
			const endPos = activeEditor.document.positionAt(match.index + match[0].length)
			const decoration = { range: new vscode.Range(startPos, endPos) }
            cellDecorations.push( decoration );
		}
        activeEditor.setDecorations( cellDecorationType, cellDecorations );
    }
    

    let ipythonOpenTerminal = vscode.commands.registerCommand('extension.ipythonOpenTerminal', function () {
        var editor = vscode.window.activeTextEditor
        if (!editor) return

        const conf = vscode.workspace.getConfiguration('ipythonIDE')
        //TODO: Check if terminal has been closed
        terminal = vscode.window.createTerminal( "ipython IDE", conf.get('pythonInterpreter'))
        terminal.show( true )
        //vscode.window.showInformationMessage('[ipython IDE] ipythonOpenTerminal()');
    })
    context.subscriptions.push( ipythonOpenTerminal )


    let ipythonChangeFolder = vscode.commands.registerCommand('extension.ipythonChangeFolder', function () {
        var editor = vscode.window.activeTextEditor
        if (!editor) return
        if ( editor.document.isClosed || editor.document.isUntitled )
            return

        const conf = vscode.workspace.getConfiguration('ipythonIDE')
        if (!terminal)
            terminal = vscode.window.createTerminal( "ipython IDE", conf.get('pythonInterpreter'))
        terminal.show( true )

        var filename = editor.document.fileName
        var filepath = filename.substring(0,filename.lastIndexOf('/'))
        if ( !filepath.isEmpty )
            terminal.sendText( 'cd "'+filepath+'"' )
    })
    context.subscriptions.push( ipythonChangeFolder )


    let ipythonRunCode = vscode.commands.registerCommand('extension.ipythonRunCode', function () {
        var editor = vscode.window.activeTextEditor
        if (!editor) return

        const conf = vscode.workspace.getConfiguration('ipythonIDE')
        if ( !terminal )
            terminal = vscode.window.createTerminal( "ipython IDE", conf.get('pythonInterpreter'))
        terminal.show( true )

        var selection = editor.selection
        var textToRun
        if ( selection.isEmpty )
            textToRun = editor.document.getText(editor.document.lineAt(selection.active.line).range)
        else
            textToRun = editor.document.getText(selection)

        // copy to clipboard
        clipboardy.writeSync( textToRun )
        terminal.sendText( conf.get('textToPaste') )

        // move line if needed
        advancePosition = conf.get('advancePosition')
        if ( selection.isEmpty && advancePosition ) {
            const position = selection.active
            if ( position.line+1 < editor.document.lineCount ) {
                var newPosition = position.with(position.line+1, 0)
                editor.selection = new vscode.Selection(newPosition, newPosition)
                editor.revealRange(new vscode.Range(editor.selection.start, editor.selection.end))
            }
        }
    })
    context.subscriptions.push( ipythonRunCode )


    let ipythonGoPrevCell = vscode.commands.registerCommand('extension.ipythonGoPrevCell', function () {
        var editor = vscode.window.activeTextEditor
        if (!editor) return

        const pos1 = new vscode.Position(0,0)
        const pos2 = editor.selection.active
        var text = editor.document.getText( new vscode.Range(pos1, pos2) )

        const re = /^#%%.*$/gm
        var idx = null
        while ( m = re.exec(text) )
            idx = m.index
        var newPosition
        if ( idx )
            newPosition = editor.document.positionAt( idx )
        else
            newPosition = new vscode.Position(0,0)
        editor.selection = new vscode.Selection(newPosition, newPosition)
        
        editor.revealRange(new vscode.Range(editor.selection.start, editor.selection.end))
    })
    context.subscriptions.push( ipythonGoPrevCell )


    let ipythonGoNextCell = vscode.commands.registerCommand('extension.ipythonGoNextCell', function () {
        var editor = vscode.window.activeTextEditor
        if (!editor) return

        const pos1 = editor.selection.active.translate(0,1)
        const offset = editor.document.offsetAt( pos1 ) // chars before
        
        var lastLine = editor.document.lineAt( editor.document.lineCount-1 )
        const pos2 = new vscode.Position( editor.document.lineCount-1, lastLine.text.length)
        var text = editor.document.getText( new vscode.Range(pos1, pos2) )

        const re = /^#%%.*$/gm
        if ( m = re.exec(text) ) {
            var newPosition = editor.document.positionAt( offset + m.index )
            editor.selection = new vscode.Selection(newPosition, newPosition)
            editor.revealRange(new vscode.Range(editor.selection.start, editor.selection.end))
        }
    })
    context.subscriptions.push( ipythonGoNextCell )


    let ipythonRunCell = vscode.commands.registerCommand('extension.ipythonRunCell', function () {
        const conf = vscode.workspace.getConfiguration('ipythonIDE')
        var editor = vscode.window.activeTextEditor
        if (!editor) return
        if (!terminal)
            terminal = vscode.window.createTerminal( "ipython IDE", conf.get('pythonInterpreter'))
        terminal.show( true )

        const re = /^#%%.*$/gm
        var posCellStart, posCellEnd
        var pos1, pos2
        var text

        // find cell start
        pos1 = new vscode.Position(0,0)
        pos2 = editor.selection.active.translate(1,0)
        text = editor.document.getText( new vscode.Range(pos1, pos2) )
        var idx = null
        while ( m = re.exec(text) )
            idx = m.index
        if ( idx )
            posCellStart = editor.document.positionAt( idx )
        else
            posCellStart = new vscode.Position(0,0)
        
        // find cell end
        pos1 = editor.selection.active.translate(0,1)
        var offset = editor.document.offsetAt( pos1 ) // chars before
        var lastLine = editor.document.lineAt( editor.document.lineCount-1 )
        pos2 = new vscode.Position( editor.document.lineCount-1, lastLine.text.length)
        text = editor.document.getText( new vscode.Range(pos1, pos2) )
        if ( m = re.exec(text) )
            posCellEnd = editor.document.positionAt( offset + m.index )
        else
            posCellEnd = pos2

        // copy text to terminal
        var textToRun = editor.document.getText( new vscode.Range(posCellStart, posCellEnd) )
        clipboardy.writeSync( textToRun )
        terminal.sendText( conf.get('textToPaste') )
    })
    context.subscriptions.push( ipythonRunCell )
}
exports.activate = activate;


function deactivate() {
}
exports.deactivate = deactivate;