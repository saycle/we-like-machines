// Enable persistent configuration
var configuration = JSON.parse(localStorage.configuration) || {states: {}};
var MachineCanvas = function () {

    var self = this;
    self.tool = 'move';
    self._canvas = document.getElementById("canvas");
    self._instance = null;
    self._initializeJsPlumb();
    self.initState();

    $(document).ready(function () {
        if (JSON.parse(localStorage.configuration))
            $("#example-selector").val("local");
        $("#example-selector-local").prop('disabled', !JSON.parse(localStorage.configuration));

        $("#example-selector").change(function () {
            $.ajax($(this).val()).done(function (res) {
                configuration = res;
                self._instance.reset();
                self._canvas.innerHTML = "";
                self._initializeJsPlumb();
                self.initState();
                setTimeout(function () {
                    jsPlumb.repaintEverything();
                }, 20);
            });
        });

        $(".tm-designer-tool").click(function () {
            self.tool = $(this).attr('tool');
            $(".tm-designer-tool").removeClass('btn-primary');
            $(this).addClass('btn-primary');
        });

    });
};

MachineCanvas.prototype.initState = function () {
    var self = this;


    // Load initial configuration
    jQuery.each(configuration.states, function (i, s) {
        self.addState(i, s);
    });

    // Connect states
    self._instance.batch(function() {
        jQuery.each(configuration.states, function (i, s) {
            jQuery.each(s.connections, function (k, c) {
                try {

                    var connection = self._instance.connect({
                        source: i,
                        target: c.newState,
                        type: 'basic'
                    });
                    var label = k + '/' + c.write + "," + c.move;
                    //label = label.replace(/ /g, '_'); // replace blank chars
                    connection.getOverlay("label").setLabel(label);
                }
                catch (e) { // endpoint does not exist - remove connection
                    console.log(e);
                    delete s.connections[k];
                }
            });
        });
    });

};

MachineCanvas.prototype.addState = function (name, model) {
    var state = new State(name, model, this);
};

MachineCanvas.prototype._initializeJsPlumb = function () {
    var machineCanvas = this;
    var instance = machineCanvas._instance = jsPlumb.getInstance({
        Endpoint: ["Dot", {radius: 5}],
        Connector: "StateMachine",
        HoverPaintStyle: {strokeStyle: "#1e8151", lineWidth: 2},
        ConnectionOverlays: [
            ["Arrow", {
                location: 1,
                id: "arrow",
                length: 14,
                foldback: 0.8
            }],
            ["Label", {label: "", id: "label", cssClass: "aLabel"}]
        ],
        Container: "canvas"
    });
    instance.registerConnectionType("basic", {anchor: "Continuous", connector: "StateMachine"});

    instance.bind("click", function (c) {
        console.log('connection clicked');
        // Connection click
        if (machineCanvas.tool == 'remove')
            instance.detach(c);
        else {
            var connectionName = promptConnectionName(c.getOverlay("label").getLabel(), c);
        }
    });

    /*instance.bind("dblclick", function (c) {
     instance.detach(c);
     });*/
    instance.bind("connection", function (info, e) {
        if (e != null) // if event is null, the connection has been created programmatically
            info.source.addConnection(info);

        /*console.log('connection added');
        info.connection.bind('click', function(c) {
            console.log(c);

            // Connection click
            if (machineCanvas.tool == 'remove')
                instance.detach(c.component);
            else {
                var connectionName = promptConnectionName(c.component.getOverlay("label").getLabel(), c.component);
            }
        });*/

    });

    instance.bind("connectionDetached", function (info) {
        info.source.removeConnection(info);
    });

    jsPlumb.on(this._canvas, "dblclick", function (e) {
        promtStateName(false, function (stateName) {
            configuration.states[stateName] = {
                presentation: {
                    position: {x: e.offsetX, y: e.offsetY}
                },
                connections: {},
                accepted: false,
            };
            machineCanvas.addState(stateName, configuration.states[stateName]);
        });
    });

};


var promptConnectionName = function (value, connection, callback) {
    var read = '';
    var write = '';
    var move = '';

    if (value) {
        read = value.split('/')[0];
        write = value.split('/')[1].split(',')[0];
        move = value.split('/')[1].split(',')[1];
    }
    var label = connection.getOverlay("label");
    bootbox.dialog({
            title: "Edit connection",
            message: '<div class="modal-body"><form class="form-horizontal" id="editConnectionForm"><div class="row">' +
            '<div class="col-sm-4"><div class="form-group"><label for="connection-read" class="control-label">Read:</label><input type="text" class="form-control" id="connection-read" maxlength="1" value="' + read + '" /></div></div>' +
            '<div class="col-sm-4"><div class="form-group"><label for="connection-write" class="control-label">Write:</label><input type="text" class="form-control" id="connection-write" maxlength="1" value="' + write + '" /></div></div>' +
            '<div class="col-sm-4"><div class="form-group"><label for="connection-move" class="control-label">Read:</label><select class="form-control" id="connection-move" value="' + move + '" ><option>L</option><option>R</option><option>S</option></select></div></div>' +
            '</div></form></div>',
            buttons: {
                success: {
                    label: "Save",
                    className: "btn-success",
                    callback: function () {
                        var connectionName = $("#connection-read").val() + '/' + $("#connection-write").val() + ',' + $("#connection-move").val();
                        label.setLabel(connectionName);
                        if (callback) {
                            callback(connectionName);
                        }
                    }
                }
            }
        }
    );
};


var promtStateName = function (value, callback) {
    var name = value ? value : '';
    bootbox.dialog({
            title: "Edit state",
            message: '<div class="modal-body"><form class="form-horizontal" id="editStateForm"><div class="row">' +
            '<div class="col-sm-12"><div class="form-group"><label for="state-name" class="control-label">Name:</label><input type="text" class="form-control" id="state-name" value="' + name + '" onkeyup="checkStateNameEdit(' + value + ')" /></div></div>' +
            '<p id="invalid-state-name">The state name is not valid or already in use</p>' +
            '</div></form></div>',
            buttons: {
                success: {
                    label: "Save",
                    className: "btn-success state-btn",
                    callback: function () {
                        var stateName = $("#state-name").val();
                        if (callback) {
                            callback(stateName);
                        }
                    }
                }
            }
        }
    );
};

function checkStateNameEdit(original) {
    var stateName = $("#state-name").val();
    if(stateName == null || stateName == '' || (configuration.states[stateName] != null && stateName != $(original).attr('id'))) {
        $(".state-btn").prop('disabled', true);
        $("#invalid-state-name").show();
    } else {
        $(".state-btn").prop('disabled', false);
        $("#invalid-state-name").hide();
    }
}

jsPlumb.ready(function () {
    var machineCanvas = new MachineCanvas();
});


var State = function (name, model, machineCanvas) {
    var self = this;

    var d = document.createElement("div");
    d.model = model;

    d.className = "w";
    d.id = name;
    d.innerHTML = name + "<div class=\"ep\"></div>";
    d.style.left = model.presentation.position.x + "px";
    d.style.top = model.presentation.position.y + "px";
    machineCanvas._instance.getContainer().appendChild(d);

    machineCanvas._instance.draggable(d, {
        drag: function (draggedWrapper) {
            $(draggedWrapper.el).one('click', function (e) {
                e.stopPropagation();
            });
            model.presentation.position.x = draggedWrapper.pos[0];
            model.presentation.position.y = draggedWrapper.pos[1];// - $(machineCanvas._instance.getContainer()).offset().top;
        }
    });

    machineCanvas._instance.makeSource(d, {
        filter: ".ep",
        anchor: "Continuous",
        connectorStyle: {strokeStyle: "#5c96bc", lineWidth: 2, outlineColor: "transparent", outlineWidth: 4},
        connectionType: "basic",
        extract: {
            "action": "the-action"
        },
        maxConnections: -1
    });

    machineCanvas._instance.makeTarget(d, {
        dropOptions: {hoverClass: "dragHover"},
        anchor: "Continuous",
        allowLoopback: true
    });

    $(d).on('click', function (e) {

        e.stopPropagation();

        if (machineCanvas.tool == 'edit') {
            promtStateName(d.id, function (newName) {
                configuration.states[newName] = configuration.states[d.id];
                delete configuration.states[d.id];
                d.id = newName;
                d.innerHTML = newName + "<div class=\"ep\"></div>";
            });
        }
        else if (machineCanvas.tool == 'remove') {
            machineCanvas._instance.detachAllConnections(d.id);
            machineCanvas._instance.removeAllEndpoints(d.id);
            machineCanvas._instance.detach(d.id);
            d.remove();
            delete configuration.states[d.id];
        }

    });

    d.addConnection = function (info) {
        console.log('addConnection');
        promptConnectionName(false, info.connection, function (connectionName) {
            console.log('test');
            model.connections[connectionName.split('/')[0]] = {
                write: connectionName.split('/')[1].split(',')[0],
                move: connectionName.split('/')[1].split(',')[1],
                newState: info.target.id
            };
        });
    };

    d.removeConnection = function (info) {
        delete model.connections[info.connection.getOverlay("label").getLabel().split('/')[0]];
    };
};

window.setInterval(function () {
    $("#code").html(JSON.stringify(configuration, null, 2));
    if (configuration != null && configuration != undefined)
        localStorage.configuration = JSON.stringify(configuration);
}, 1000);