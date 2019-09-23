// Set dimensions of the panel with the task, legend, and user response and without those pieces
let panelDimensions = { width: 0, height: 0 };
let visDimensions = { width: 0, height: 0 };

var defaultDomains = { node: {}, edge: {} };
var scales = {};

//Legend Scales
var circleScale = d3.scaleLinear().domain([0, 1]);

var edgeScale = d3.scaleLinear().domain([0, 1]);

var height;
var width;
let taskBar_height;

var svg;
var margin = { left: 0, right: 100, top: 0, bottom: 0 };

var simulation; //so we're not restarting it every time updateVis is called;

let wasDragged = false;

let graph_structure;

// var tooltipTimeout; 

//global sizes
let nodeMarkerLength, nodeMarkerHeight, checkboxSize;

//global scales
let nodeLength,
    quantColors,
    nodeHeight,
    nodeFill,
    catFill,
    // nodeStroke,
    edgeColor,
    edgeWidth;

// Draws the visualization on first load
async function makeVis() {
    // Set the UI
    removeConfig(configPanel)

    //Load from multinet
    graph_structure = await load_data(workspace, graph)

    // Set up the search box
    populateSearchList(graph_structure)
    resetSearchBox()

    // Start provenance
    initializeProvenance(graph_structure)
    console.log("app = ", app)

    // Attach the search box code to the button
    d3.select('#searchButton').on("click", () => searchForNode());

    loadVis();
}

nodeLength = function(node) {
    let nodeSizeScale = d3
        .scaleLinear()
        .range([nodeMarkerLength / 2, nodeMarkerLength * 2])
        .clamp(true);

    //if an attribute has been assigned to nodeSizeAttr, set domain
    // if (config.nodeLink.nodeSizeAttr) {
    //     nodeSizeScale.domain(
    //         config.attributeScales.node[config.nodeLink.nodeSizeAttr].domain
    //     );
    // }

    let value =
        // config.nodeLink.nodeSizeAttr && !config.nodeLink.drawBars ?
        // nodeSizeScale(node[config.nodeLink.nodeSizeAttr]) :
        nodeMarkerLength;
    //make circles a little larger than just the radius of the marker;
    return value; //config.nodeIsRect ? value : value * 1.3;
};

nodeHeight = function(node) {
    let nodeSizeScale = d3
        .scaleLinear()
        .range([nodeMarkerHeight / 2, nodeMarkerHeight * 2])
        .clamp(true);

    //if an attribute has been assigned to nodeSizeAttr, set domain
    // if (config.nodeLink.nodeSizeAttr) {
    //     nodeSizeScale.domain(
    //         config.attributeScales.node[config.nodeLink.nodeSizeAttr].domain
    //     );
    // }

    let value =
        // config.nodeLink.nodeSizeAttr && !config.nodeLink.drawBars ?
        // nodeSizeScale(node[config.nodeLink.nodeSizeAttr]) :
        nodeMarkerHeight;
    return value; //config.nodeIsRect ? value : value * 1.3;
};

function setGlobalScales() {
    nodeMarkerLength = 60;
    nodeMarkerHeight = 35;
    checkboxSize = nodeMarkerHeight / 4;

    //Create Scale Functions

    nodeFill = function(node) {
        let nodeFillScale = d3.scaleOrdinal();


        //if an attribute has been assigned to nodeFillAttr, set domain
        if (config.nodeLink.nodeFillAttr) {
            nodeFillScale
                .domain(
                    config.attributeScales.node[config.nodeLink.nodeFillAttr].domain
                )
                .range(config.attributeScales.node[config.nodeLink.nodeFillAttr].range);
        }

        let value =
            config.nodeLink.nodeFillAttr && !config.nodeLink.drawBars ?
            nodeFillScale(node[config.nodeLink.nodeFillAttr]) :
            (config.nodeLink.drawBars ? "white" : config.nodeLink.noNodeFill);

        return value;
    };

    //function to determine fill color of nestedCategoricalMarks
    catFill = function(attr, value) {
        //assume there are defined domain and ranges for these
        let nodeFillScale = d3
            .scaleOrdinal()
            .domain(config.attributeScales.node[attr].domain)
            .range(config.attributeScales.node[attr].range);

        return nodeFillScale(value);
    };

    // nodeStroke = function(selected) {
    //   return selected
    //     ? config.style.selectedNodeColor
    //     : config.nodeLink.noNodeStroke;
    // };

    edgeColor = function(edge) {
        let edgeStrokeScale = d3.scaleOrdinal();

        if (config.nodeLink.edgeStrokeAttr) {
            edgeStrokeScale
                .domain(
                    config.attributeScales.edge[config.nodeLink.edgeStrokeAttr].domain
                )
                .range(
                    config.attributeScales.edge[config.nodeLink.edgeStrokeAttr].range
                );
        }

        let value = config.nodeLink.edgeStrokeAttr ?
            edgeStrokeScale(edge[config.nodeLink.edgeStrokeAttr]) :
            config.nodeLink.noEdgeColor;

        return value;

        // edge.selected
        // ? config.style.selectedEdgeColor
        // : value;
    };

    edgeWidth = function(edge) {

        let edgeWidthScale = d3
            .scaleLinear()
            .range([2, 10])
            .clamp(true)

        if (config.nodeLink.edgeWidthAttr) {
            edgeWidthScale
                .domain(config.attributeScales.edge[config.nodeLink.edgeWidthAttr].domain)
        }


        let value = config.nodeLink.edgeWidthAttr ?
            edgeWidthScale(edge[config.nodeLink.edgeWidthAttr]) :
            (edgeWidthScale.range()[1] - edgeWidthScale.range()[0]) / 3


        return value;
    };
}

//function that checks the state to see if the node is selected
function isSelected(node) {
    const currentState = app.currentState();

    //find out if this node was selected before;
    let selected = currentState.selected;
    return selected.includes(node.id);
}

//function that updates the state, and includes a flag for when this was done through a search
function nodeClick(node, search = false) {

    const currentState = app.currentState();

    //find out if this node was selected before;
    let selected = currentState.selected;


    let wasSelected = isSelected(node);

    if (wasSelected) {
        selected = selected.filter(s => s !== node.id);
    } else {
        selected.push(node.id);
    }

    let neighbors = tagNeighbors(
        node, !wasSelected,
        currentState.userSelectedNeighbors
    );

    let label = search ?
        "Searched for Node" :
        wasSelected ?
        "Unselect Node" :
        "Select Node";

    let action = {
        label: label,
        action: () => {
            const currentState = app.currentState();
            //add time stamp to the state graph
            currentState.time = Date.now();
            //Add label describing what the event was
            currentState.event = label;
            //Update actual node data
            currentState.selected = selected;
            currentState.userSelectedNeighbors = neighbors;
            //If node was searched, push him to the search array
            if (search) {
                currentState.search.push(node.id);
            }
            return currentState;
        },
        args: []
    };

    provenance.applyAction(action);
}

function tagNeighbors(clickedNode, wasClicked, userSelectedNeighbors) {
    // if (!config.nodeLink.selectNeighbors) {
    //     return {};
    // }

    // //iterate through the neighbors of the currently clicked node only and set or remove itself from the relevant lists;
    // clickedNode.neighbors.map(neighbor => {
    //     toggleSelection(neighbor);
    // });

    // //'tag or untag neighboring links as necessary
    // graph.links.map(link => {
    //     if (
    //         link.source.id == clickedNode.id ||
    //         link.target.id == clickedNode.id
    //     ) {
    //         toggleSelection(link.id);
    //     }
    // });

    // //helper function that adds or removes the clicked node id from the userSelectedNeighbors map as necessary
    // function toggleSelection(target) {
    //     if (wasClicked) {
    //         userSelectedNeighbors[target] ?
    //             userSelectedNeighbors[target].push(clickedNode.id) :
    //             (userSelectedNeighbors[target] = [clickedNode.id]);
    //     } else {
    //         if (userSelectedNeighbors[target]) {
    //             userSelectedNeighbors[target] = userSelectedNeighbors[target].filter(
    //                 n => n !== clickedNode.id
    //             );

    //             // if array is empty, remove key from dict;
    //             if (userSelectedNeighbors[target].length === 0) {
    //                 delete userSelectedNeighbors[target];
    //             }
    //         }
    //     }
    // }

    // return userSelectedNeighbors;
}

// Setup function that does initial sizing and setting up of elements for node-link diagram.
function loadVis() {
    let targetDiv = d3.select("#targetSize");
    width = targetDiv.style("width").replace("px", "");
    height = targetDiv.style("height").replace("px", "");

    visDimensions.width = width * 0.75 - 24;
    visDimensions.height = height;

    panelDimensions.width = width * 0.25;
    panelDimensions.height = height;


    d3.select("#visPanel").style("width", panelDimensions.width + "px");

    svg = d3
        .select("#node-link-svg")
        .attr("width", visDimensions.width) //size + margin.left + margin.right)
        .attr("height", visDimensions.height);

    // Set up groups for nodes/links
    svg.append("g").attr("class", "links");
    svg.append("g").attr("class", "nodes");

    let parentWidth = d3
        .select("#visPanel")
        .select(".content")
        .node()
        .getBoundingClientRect().width;

    legend = d3
        .select("#legend-svg")
        .attr("width", parentWidth) //size + margin.left + margin.right)
        .attr("height", 270);

    //add tooltip
    d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    simulation = d3
        .forceSimulation()
        .force(
            "link",
            d3.forceLink().id(function(d) {
                return d._key;
            })
        )
        .force("charge", d3.forceManyBody().strength(10))
        .force(
            "center",
            d3.forceCenter(visDimensions.width / 2, visDimensions.height / 2)
        );

    updateVis(graph_structure)
}

function initializeProvenance(graph_structure) {
    // pass in workerID to setupProvenance
    setUpProvenance(graph_structure.nodes /*, task.taskID, task.order*/ );

    setUpObserver("selected", highlightSelectedNodes);
    setUpObserver("hardSelected", highlightHardSelectedNodes);
    setUpObserver("nodePos", updatePos);

    update();
}

function highlightSelectedNodes(state) {
    console.log("calling highlightSelectedNodes");
    // see if there is at least one node 'clicked'
    //check state not ui, since ui has not yet been updated;
    let hasUserSelection = state.selected.length > 0;

    //set the class of everything to 'muted', except for the selected node and it's neighbors;
    d3.select(".nodes")
        .selectAll(".nodeGroup")
        .classed("muted", d => {
            return (
                hasUserSelection &&
                !state.hardSelected.includes(d.id) &&
                !state.selected.includes(d.id) &&
                !state.userSelectedNeighbors[d.id] //this id exists in the dict
            );
        });

    d3.select(".nodes")
        .selectAll(".node")
        .classed("clicked", d => state.selected.includes(d.id))
        .classed("selected", d => state.hardSelected.includes(d.id));


    d3.select(".links")
        .selectAll(".linkGroup")
        .classed(
            "muted",
            d =>
            config.nodeLink.selectNeighbors &&
            hasUserSelection &&
            !state.userSelectedNeighbors[d.id] //this id exists in the dict
        );
    // .select('path')
    // .style("stroke", edgeColor);

    d3.selectAll(".nodeGroup")
        .select(".node")
        .style("fill", nodeFill) //using local bound data, ok, since state should not influence the fill
        // .style("stroke", d => nodeStroke(state.selected.includes(d.id)));
}

function selectNode(node) {
    d3.event.stopPropagation();
    const currentState = app.currentState();

    //find out if this node was selected before;
    let selected = currentState.hardSelected;
    let wasSelected = selected.includes(node.id);

    if (wasSelected) {
        selected = selected.filter(s => s !== node.id);
    } else {
        selected.push(node.id);
    }

    let label = wasSelected ? "Hard Unselected a Node" : "Hard Selected a Node";

    let action = {
        label: label,
        action: () => {
            const currentState = app.currentState();
            //add time stamp to the state graph
            currentState.time = Date.now();
            //Add label describing what the event was
            currentState.event = label;
            //Update actual node data
            currentState.hardSelected = selected;
            return currentState;
        },
        args: []
    };

    provenance.applyAction(action);
}

function highlightHardSelectedNodes(state) {

    let hasUserSelection = state.selected.length > 0;


    d3.selectAll(".selectBox").classed("selected", d =>
        state.hardSelected.includes(d.id)
    );
    d3.select(".nodes")
        .selectAll(".nodeGroup")
        .classed("selected", d => state.hardSelected.includes(d.id))
        .classed("muted", d => {
            return (
                config.nodeLink.selectNeighbors &&
                hasUserSelection &&
                !state.hardSelected.includes(d.id) &&
                !state.selected.includes(d.id) &&
                !state.userSelectedNeighbors[d.id] //this id exists in the dict
            );
        });

    d3.select(".nodes")
        .selectAll(".node")
        .classed("selected", d => state.hardSelected.includes(d.id));



    //update the list of selected nodes in the answer panel.
    updateAnswer(graph.nodes.filter(n => state.hardSelected.includes(n.id)));
}

function dragNode() {
    d3.selectAll(".linkGroup")
        .select("path")
        .attr("d", function(d) {
            let path = arcPath(1, d);
            if (path.includes("null")) {
                console.log("bad path");
            }
            return path;
        });

    let radius = 25;

    d3.selectAll(".nodeGroup").attr("transform", d => {
        d.x = Math.max(radius, Math.min(visDimensions.width, d.x));
        d.y = Math.max(radius, Math.min(visDimensions.height, d.y));
        return "translate(" + d.x + "," + d.y + ")";
    });
}

function updatePos(state) {
    console.log("calling  updatePos");
    d3.selectAll(".linkGroup")
        .select("path")
        .attr("d", function(d) {
            let path = arcPath(1, d, //state
            );
            if (path.includes("null")) {
                console.log("bad path");
            }
            return path;
        });

    d3.selectAll(".nodeGroup").attr(
        "transform",
        d =>
        "translate(" + state.nodePos[d.id].x + "," + state.nodePos[d.id].y + ")"
    );
}

function arcPath(leftHand, d, state = false) {
    console.log("in arcpath")
    let source = state ? { x: state.nodePos[d.source.id].x, y: state.nodePos[d.source.id].y } :
        d._from;
    let target = state ? { x: state.nodePos[d.target.id].x, y: state.nodePos[d.target.id].y } :
        d._to;

    source = graph_structure.nodes.find(x => x._id === source)
    target = graph_structure.nodes.find(x => x._id === target)

    var x1 = leftHand ? parseFloat(source.x) + 25 : target.x,
        y1 = leftHand ? parseFloat(source.y) + 25 : target.y,
        x2 = leftHand ? parseFloat(target.x) + 25 : source.x,
        y2 = leftHand ? parseFloat(target.y) + 25 : source.y;
    (dx = x2 - x1),
    (dy = y2 - y1),
    (dr = Math.sqrt(dx * dx + dy * dy)),
    (drx = dr),
    (dry = dr),
    (sweep = leftHand ? 0 : 1);
    // siblingCount = countSiblingLinks(graph, d.source, d.target);
    (xRotation = 0), (largeArc = 0);

    // if (siblingCount > 1) {
    //   var siblings = getSiblingLinks(graph, d.source, d.target);
    //   var arcScale = d3
    //     .scaleOrdinal()
    //     .domain(siblings)
    //     .range([1, siblingCount]);

    //   drx = drx / (1 + (1 / siblingCount) * (arcScale(d.type) - 1));
    //   dry = dry / (1 + (1 / siblingCount) * (arcScale(d.type) - 1));
    // }



    // if (config.isMultiEdge){
    return (
        "M" +
        x1 +
        "," +
        y1 +
        "A" +
        drx +
        ", " +
        dry +
        " " +
        xRotation +
        ", " +
        largeArc +
        ", " +
        sweep +
        " " +
        x2 +
        "," +
        y2
    );


    // } else {
    //   return (
    //     'M '+source.x+' '+source.y+' L '+ target.x +' '+target.y );
    // }



    // return ("M" + x1 + "," + y1
    //    + "S" + x2 + "," + y2
    //    + " " + x2 + "," + y2)
}

function showTooltip(data, delay = 200) {

    let tooltip = d3.select('.tooltip');

    tooltip.html(data)
        .style("left", (window.event.clientX + 10) + "px")
        .style("top", (window.event.clientY - 20) + "px");

    tooltip.transition().duration(delay).style("opacity", .9);

}

function hideTooltip() {
    d3.select('.tooltip').transition().duration(100).style("opacity", 0);
}

async function updateVis(graph_structure) {

    //setGlobalScales();

    let fakeSmallNode = {};
    let fakeLargeNode = {};

    //create scales for bars;
    // let barAttributes = config.nodeAttributes.filter(isQuant);

    let scaleColors = {}; //Object to store which color to use for which scales

    let barPadding = 3;

    // barAttributes.map((b, i) => {
    //     let scale = d3
    //         .scaleLinear()
    //         .domain(config.attributeScales.node[b].domain)
    //         .range([0, nodeMarkerHeight - 2 * barPadding])
    //         .clamp(true);

    //     let domainKey = scale.domain().join("-");
    //     scaleColors[domainKey] = "";

    //     //save scale and color to use with that attribute bar
    //     scales[b] = { scale, domainKey };
    // });

    let singleDomain = Object.keys(scaleColors).length === 1;
    //Assign one color per unique domain;

    //if only using one domain, use light grey; otherwise, use colors;
    Object.keys(scaleColors).map((domainKey, i) => {
        scaleColors[domainKey] = singleDomain ? "#afafaf" : quantColors(i);
    });

    Object.keys(scales).map(
        s => (scales[s].fill = scaleColors[scales[s].domainKey])
    );

    //Drawing Graph



    // TO DO , set ARROW DIRECTION DYNAMICALLY
    // link
    //     .select("textPath")
    //     .attr("xlink:href", d => "#" + d.id)
    //     .text(d => (config.isDirected ? (d.type === "mentions" ? "▶" : "◀") : ""))
    //     .style("fill", edgeColor)
    //     .style("stroke", edgeColor)


    //draw Nodes
    //let drawCat = Object.keys(config.nodeAttributes.filter(isCategorical)).length > 0;
    let drawCat = 0
    let radius = drawCat ? nodeMarkerHeight * 0.15 : 0;
    let padding = drawCat ? 3 : 0;

    console.log("nodes", graph_structure.nodes)
    var node = d3
        .select(".nodes")
        .selectAll(".nodeGroup")
        .data(graph_structure.nodes);

    let nodeEnter = node
        .enter()
        .append("g")
        .attr("class", "nodeGroup")



    nodeEnter.append("rect").attr("class", "nodeBorder nodeBox");
    nodeEnter.append("rect").attr("class", "node nodeBox");


    nodeEnter.append("rect").attr("class", "labelBackground");

    nodeEnter.append("text").classed("label", true);

    nodeEnter.append("rect").classed("selectBox", true);

    node.exit().remove();

    node = nodeEnter.merge(node);

    node.classed("muted", false)
        .classed("selected", false)
        .attr("transform", d => {
            d.x = d.x === undefined ? (Math.random() * visDimensions.width - margin.left - margin.right) + 100 : Math.max(radius, Math.min(visDimensions.width, d.x));
            d.y = d.y === undefined ? (Math.random() * visDimensions.height - margin.bottom - margin.top) : Math.max(radius, Math.min(visDimensions.height, d.y));
            return "translate(" + d.x + "," + d.y + ")";
        });


    //determine the size of the node here: 
    // let barAttrs = config.nodeLink.drawBars ?
    //     config.nodeAttributes.filter(isQuant) : [];




    // nodeMarkerLength = config.nodeLink.drawBars ? barAttrs.length * 10 + barPadding + radius * 2 + padding : nodeMarkerLength;
    nodeMarkerLength = false ? barAttrs.length * 10 + barPadding + radius * 2 + padding : nodeMarkerLength;

    let nodePadding = 2;
    let sizeDiff = 55 - nodeMarkerLength;
    let extraPadding = sizeDiff > 0 ? sizeDiff : 0;

    node
        .selectAll(".nodeBox")
        // .attr("x", d => d.x)
        // .attr("y", d => d.y)
        .attr("width", d => 50)
        .attr("height", d => 50)
        .attr("rx", d => 25) //nodeLength(d)/20
        .attr("ry", d => 25);

    node.select('.node')
        .style("fill", "#888888")
        // .classed("clicked", d => app.currentState().selected.includes(d.id))
        // .classed("selected", d => app.currentState().hardSelected.includes(d.id))

    .on("mouseover", function(d) {

        let tooltipData = 'hello node';

        // if (config.nodeLink.nodeFillAttr) {
        //     tooltipData = tooltipData.concat(config.nodeLink.nodeFillAttr + ":" + d[config.nodeLink.nodeFillAttr] + " ")
        // };

        // if (config.nodeLink.nodeSizeAttr) {
        //     tooltipData = tooltipData.concat(config.attributeScales.node[config.nodeLink.nodeSizeAttr].label + ":" + Math.round(d[config.nodeLink.nodeSizeAttr]) + " ")
        // }

        // config.nodeLink.drawBars ? "" : 
        showTooltip(tooltipData)
    })


    node
        .select("text")
        .classed("selected", d => d.hardSelect)
        .style("font-size", //config.nodeLink.drawBars ? config.nodeLink.labelSize : 
            '18')
        .text(d => d.name)
        // .attr("y", d =>
        //     // config.nodeLink.drawBars ? -nodeMarkerHeight / 2 - 2 : 
        //     d.y
        // )
        .attr('dy', //config.nodeLink.drawBars ? 0 : 
            -2)
        .attr("dx", function(d) {

            //let textWidth = -d3.select(this).node().getBBox().width / 2

            return false ? -nodeMarkerLength / 2 - barPadding / 2 - extraPadding / 2 + checkboxSize + 3 : 50 + 8
        })

    // .attr('x', d => d.x)
    .on("click", selectNode);

    node
        .select(".labelBackground")
        // .classed('nested', config.nodeLink.drawBars)
        // .attr("width", function(d) {
        //   let textWidth = d3
        //     .select(d3.select(this).node().parentNode)
        //     .select(".label")
        //     .node()
        //     .getBBox().width;

    //   //make sure label box spans the width of the node
    //   return config.nodeLink.drawBars ? nodeMarkerLength + 30 : d3.max([textWidth, nodeLength(d)])+4;
    // })
    .attr("width", d => false ? nodeLength(d) + 8 + nodePadding + extraPadding : nodeLength(d) + 8)
        .on("click", selectNode)


    .attr('height', //config.nodeLink.drawBars ? 16 : 
            "1em")
        // .attr("x", function(d) {
        //   let textWidth = d3
        //     .select(d3.select(this).node().parentNode)
        //     .select("text")
        //     .node()
        //     .getBBox().width;

    //   //make sure label box spans the width of the node
    //   return config.nodeLink.drawBars ? -nodeMarkerLength / 2 -15  : d3.min([-textWidth / 2, -nodeLength(d) / 2 - 2]);
    // })

    .attr("x", d => false ? -nodeLength(d) / 2 - 4 - nodePadding / 2 - extraPadding / 2 : -nodeLength(d) / 2 - 4)

    .attr("y", d =>
        // config.nodeLink.drawBars ? -nodeMarkerHeight / 2 - 14 : 
        "-.5em"
    );

    node
        .select(".selectBox")
        .classed("selected", d => d.hardSelect)
        .attr("width", checkboxSize)

    // .attr("x", function(d) {
    //     let nodeLabel = d3
    //         .select(d3.select(this).node().parentNode)
    //         .select("text");

    //     // let textWidth = nodeLabel.node().getBBox().width;
    //     // return -textWidth / 2 - checkboxSize - 5;

    //     return config.nodeIsRect ? -nodeMarkerLength / 2 - nodePadding / 2 - extraPadding / 2 : -textWidth / 2 - checkboxSize / 2;

    // })
    // .attr("y", d =>
    //   config.nodeLink.drawBars
    //     ? -(nodeHeight(d) / 2 + 4 + checkboxSize)
    //     : -checkboxSize / 2
    // )
    .attr("y", d =>
            // config.nodeLink.drawBars ?
            -(nodeMarkerHeight / 2) - 11
            // :
            // -checkboxSize / 2
        )
        // .attr("x", -nodeMarkerLength/2 -checkboxSize)
        // .attr("x", d => {
        //   // let nodeLabel = d3
        //   //     .select(d3.select(this).node().parentNode)
        //   //     .select("text");

    //   //   let textWidth = nodeLabel.node().getBBox().width;
    //   //   return -textWidth / 2 - checkboxSize/2;

    //   return config.nodeIsRect ? -nodeMarkerLength/2 - nodePadding/2 -extraPadding/2  :-nodeLength(d) / 2 - 4;
    // })

    // .attr("y", -checkboxSize / 2 - 5)
    .on("click", selectNode);

    node.call(
        d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

    //Draw Links
    let link = d3
        .select(".links")
        .selectAll(".linkGroup")
        .data(graph_structure.links);

    let linkEnter = link
        .enter()
        .append("g")
        .attr("class", "linkGroup");

    linkEnter.append("path").attr("class", "links");

    linkEnter
        .append("text")
        .attr("class", "edgeArrow")
        .attr("dy", 4)
        .append("textPath")
        .attr("startOffset", "50%");

    link.exit().remove();

    link = linkEnter.merge(link);


    link.classed("muted", false);

    link
        .select("path")
        .style("stroke-width", 10)
        .style("stroke", "#888888")
        .attr("id", d => d._key)
        .attr("d", d => arcPath(1, d))
        .on("mouseover", function(d) {

            //     // console.log (d)
            let tooltipData = "hello"; //d.name;

            //     if (config.nodeLink.edgeWidthAttr) {
            //         tooltipData = tooltipData.concat(" [" + d.count + "]")
            //     }

            showTooltip(tooltipData, 400)


        })

    .on("mouseout", function(d) {
        hideTooltip();
    })


    //Drawing Nested Bar Charts

    // //  Separate enter/exit/update for bars so as to bind to the correct data;

    // let xPos = drawCat ? nodeMarkerLength / 2 - radius : 0;

    // let numBars = barAttrs.length;
    // let nodeWidth = nodeMarkerLength - barPadding - radius * 2 - padding;
    // let barWidth = nodeWidth / numBars - barPadding;

    // let scaleStart = -nodeMarkerLength / 2 + barPadding;
    // let scaleEnd = scaleStart + (numBars - 1) * (barWidth + barPadding);

    // let barXScale = d3
    //     .scaleLinear()
    //     .domain([0, numBars - 1])
    //     .range([scaleStart, scaleEnd]);

    // let bars = node
    //     .selectAll(".bars")
    //     //for each bar associate the relevant data from the parent node, and the attr name to use the correct scale
    //     .data(
    //         d =>
    //         barAttrs.map(b => {
    //             return { data: d[b], attr: b };
    //         }),
    //         d => d.attr
    //     );

    // let barsEnter = bars
    //     .enter()
    //     .append("g")
    //     .attr("class", "bars");

    // barsEnter
    //     .append("rect")
    //     .attr("class", "frame")
    //     .append("title");

    // barsEnter
    //     .append("rect")
    //     .attr("class", "bar")
    //     .append("title");

    // bars.exit().remove();

    // bars = barsEnter.merge(bars);

    // bars.selectAll("rect").attr("width", barWidth);

    // // bars.selectAll("title").text(function(d) {
    // //   return d.attr + " : " + d.data;
    // // });

    // bars.on("mouseover", function(d) {
    //     let label = config.attributeScales.node[d.attr].label
    //     showTooltip(label + " : " + Math.round(d.data))
    // })

    // bars.attr("transform", (d, i) => {
    //     return "translate(" + barXScale(i) + ",2)";
    // });

    // bars
    //     .select(".frame")
    //     .attr("height", d => scales[d.attr].scale.range()[1])
    //     .attr("y", d => -scales[d.attr].scale.range()[1] / 2)
    //     .style("stroke", d => scales[d.attr].fill);

    // bars
    //     .select(".bar")
    //     .classed("clipped", d => d.data > scales[d.attr].scale.domain()[1])
    //     .attr("height", d => scales[d.attr].scale(d.data))
    //     .attr(
    //         "y",
    //         d => nodeMarkerHeight / 2 - barPadding - scales[d.attr].scale(d.data)
    //     )
    //     .style("fill", d => scales[d.attr].fill);

    // d3.select("#nodeBarsSelect")
    //     .selectAll("label")
    //     .style("color", "#a6a6a6")
    //     .style("font-weight", "normal");

    // //color the text from the panel accordingly
    // d3.select("#nodeQuantSelect")
    //     .selectAll("label")
    //     .style("color", d =>
    //         barAttrs.includes(d.attr) ? scales[d.attr].fill : "#b2afaf"
    //     )
    //     .style("font-weight", "bold");

    // let catAttrs = config.nodeLink.drawBars ?
    //     config.nodeAttributes.filter(isCategorical) : [];

    // let yRange =
    //     catAttrs.length < 2 ? [1, 1] : [-nodeMarkerHeight * 0.2 + 1, nodeMarkerHeight * 0.2 + 1];

    // let catYScale = d3
    //     .scaleLinear()
    //     .domain([0, catAttrs.length - 1])
    //     .range(yRange);

    // let catGlyphs = node
    //     .selectAll(".categorical")
    //     //for each circle associate the relevant data from the parent node
    //     .data(
    //         d =>
    //         catAttrs.map(attr => {
    //             let valuePos = config.attributeScales.node[attr].domain.indexOf(
    //                 d[attr]
    //             );
    //             return {
    //                 data: d[attr],
    //                 attr,
    //                 label: config.attributeScales.node[attr].legendLabels[valuePos]
    //             };
    //         }),
    //         d => d.attr
    //     );

    // let catGlyphsEnter = catGlyphs
    //     .enter()
    //     .append("g")
    //     .attr("class", "categorical");

    // catGlyphsEnter.append("rect");
    // catGlyphsEnter.append("text");

    // catGlyphs.exit().remove();

    // catGlyphs = catGlyphsEnter.merge(catGlyphs);

    // catGlyphs.on("mouseover", function(d) {
    //     showTooltip(d.attr + ":" + d.data)
    // })


    // catGlyphs.attr(
    //     "transform",
    //     (d, i) =>
    //     "translate(" + (xPos - radius) + "," + (catYScale(i) - radius) + ")"
    // );
    // // .attr("x", xPos - radius)
    // // .attr("y", (d, i) => catYScale(i) - radius)

    // catGlyphs
    //     .select("rect")
    //     .style("fill", d => catFill(d.attr, d.data))
    //     .attr("width", d =>
    //         config.attributeScales.node[d.attr].type === "Text" ?
    //         radius * 2 :
    //         radius * 2
    //     )
    //     .attr("height", radius * 2)
    //     .attr("rx", d =>
    //         config.attributeScales.node[d.attr].glyph === "square" ? 0 : radius * 2
    //     )
    //     .attr("ry", d =>
    //         config.attributeScales.node[d.attr].glyph === "square" ? 0 : radius * 2
    //     );

    // catGlyphs
    //     .select("text")
    //     // .text(d=>config.attributeScales.node[d.attr].glyph === 'square' ? d.label : '')
    //     .attr("y", radius * 2)
    //     .attr("x", radius * 2)
    //     .style("text-anchor", "start");


    d3.select("#exportGraph").on("click", () => {
        let graphCopy = JSON.parse(JSON.stringify(graph));

        // graphCopy.links.map(l => {
        //   l.index = undefined;
        //   l.source = l.source.id;
        //   l.target = l.target.id;
        // });
        // graphCopy.nodes.map(n => {
        //   n.index = undefined;
        //   n.vx = undefined;
        //   n.vy = undefined;
        //   n.fx = n.x;
        //   n.fy = n.y;
        // });

        let newGraph = { nodes: [], links: [] };

        graphCopy.links.map(l => {
            newLink = {};
            l.index = undefined;
            l.weight = l.count;
            let source = graphCopy.nodes.find(n => n.id === l.source.id);
            newLink.source = graphCopy.nodes.indexOf(source);

            let target = graphCopy.nodes.find(n => n.id === l.target.id);
            newLink.target = graphCopy.nodes.indexOf(target);
            newLink.id = newGraph.links.length;
            l.id = newLink.id;

            newGraph.links.push(newLink);
        });

        graphCopy.nodes.map(n => {
            let newNode = {};
            newNode.name = n.shortName;
            newNode.id = n.id;
            newGraph.nodes.push(newNode);
        });

        var items = graphCopy.links;
        const replacer = (key, value) => (value === null ? "" : value); // specify how you want to handle null values here
        const header = Object.keys(items[0]).filter(
            k => k !== "source" && k !== "target"
        );
        let csv = items.map(row =>
            header
            .map(fieldName => JSON.stringify(row[fieldName], replacer))
            .join(",")
        );
        csv.unshift(header.join(","));
        csv = csv.join("\r\n");

        // let parseInputFilename =
        // let filename = config.isDirected ? config.directedGraph : config.undir_graph;

        // console.log(JSON.stringify(newGraph));
    });




    node.on("mouseout", () => {
        hideTooltip()
    })

    node.on("click", d => nodeClick(d));





    //set up simulation
    simulation.nodes(graph.nodes).on("tick", ticked);
    simulation
        .force("link")
        .links(graph_structure.links)
        .distance(l => l.count);
    simulation.force(
        "collision",
        d3.forceCollide().radius(d => d3.max([nodeLength(d), nodeHeight(d)]))
    );

    //if source/target are still strings from the input file
    if (graph_structure.links[0]._from._key === undefined) {
        //restablish link references to their source and target nodes;
        graph.links.map(l => {
            l.source =
                graph.nodes.find(n => n.id === l.source) ||
                graph.nodes[l.source] ||
                l.source;
            l.target =
                graph.nodes.find(n => n.id === l.target) ||
                graph.nodes[l.target] ||
                l.target;
        });
    }
    //check to see if there are already saved positions in the file, if not
    //run simulation to get fixed positions;

    //remove collision force
    // simulation.force('collision',null);

    dragNode();

    // else {
    //   graph.nodes.map(n => {
    //     n.x = 0;
    //     n.y = 0;
    //     n.vx = null;
    //     n.vy = null;
    //     n.fx = null;
    //     n.fy = null;
    //   });

    //   for (var i = 0; i < 2000; ++i) simulation.tick();
    //   simulation.stop();

    //   //  add a collision force that is proportional to the radius of the nodes;
    //   simulation.force("collision", d3.forceCollide().radius(d => nodeLength(d)));

    //   simulation.alphaTarget(0.1).restart();
    // }

    d3.select("#stop-simulation").on("click", () => {
        simulation.stop();
        graph.nodes.map(n => {
            n.savedX = n.x;
            n.savedY = n.y;
        });
    });

    d3.select("#start-simulation").on("click", () => {
        simulation.alphaTarget(0.1).restart();
    });

    d3.select("#release-nodes").on("click", () => {
        graph.nodes.map(n => {
            n.fx = null;
            n.fy = null;
        });
        simulation.alphaTarget(0.1).restart();
    });

    function ticked() {
        dragNode();
    }

    //Flag to distinguish a drag from a click.
    let wasDragged = false;

    function dragstarted(d) {
        // if (!d3.event.active) simulation.alphaTarget(0.1).restart();
        d.fx = d.x;
        d.fy = d.y;
        // dragging = true;
    }

    function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
        d.x = d3.event.x;
        d.y = d3.event.y;
        dragNode();
        wasDragged = true;

        // console.log('dragged')
    }

    function dragended(d) {
        if (wasDragged) {
            //update node position in state graph;
            // updateState("Dragged Node");

            let action = {
                label: "Dragged Node",
                action: () => {
                    const currentState = app.currentState();
                    //add time stamp to the state graph
                    currentState.time = Date.now();
                    //Add label describing what the event was
                    currentState.event = "Dragged Node";
                    //Update node positions
                    graph.nodes.map(
                        n => (currentState.nodePos[n.id] = { x: n.x, y: n.y })
                    );
                    return currentState;
                },
                args: []
            };

            provenance.applyAction(action);
        }
        wasDragged = false;
    }

    drawLegend();
}

function drawLegend() {
    //draw legend based on config;

    let legendElement = d3
        .select("#legend-svg")
        .selectAll(".legendGroup")
        .data(["upperGroup", "lowerGroup"], d => d);

    let legendElementEnter = legendElement
        .enter()
        .append("g")
        .attr("class", "legendGroup");

    legendElement.exit().remove;

    legendElement = legendElementEnter.merge(legendElement);
    legendElement.attr("class", d => d + " legendGroup");

    let legend = {
        width: d3.select("#legend-svg").attr("width"),
        height: d3.select("#legend-svg").attr("height"),
        padding: 10
    };

    let drawBars = config.nodeLink.drawBars;

    let quantAttributes = drawBars ? config.nodeAttributes.filter(isQuant) : [];
    let catAttributes = drawBars ?
        config.nodeAttributes.filter(isCategorical) : [];

    let colorAttribute = config.nodeLink.nodeFillAttr;
    let sizeAttribute = drawBars ? [] : config.nodeLink.nodeSizeAttr;
    let edgeAttribute = config.nodeLink.edgeWidthAttr;

    let edgeStrokeScale = d3
        .scaleOrdinal()
        .domain(config.attributeScales.edge["type"].domain)
        .range(config.attributeScales.edge["type"].range);

    let edgeAttributeValues = edgeAttribute ? config.attributeScales.edge[edgeAttribute].domain : false;
    let edgeTypes = config.isMultiEdge ? ["mentions", "retweet"] : [];

    let colorAttributeValues =
        drawBars || !colorAttribute ? [] :
        config.attributeScales.node[config.nodeLink.nodeFillAttr].legendLabels;

    let sizeAttributeValues = drawBars || !config.nodeLink.nodeSizeAttr ? [] :
        config.attributeScales.node[config.nodeLink.nodeSizeAttr].domain;

    let barWidth = 20;
    let barPadding = 30;
    let barHeight = 70;

    let circleRadius = 40;
    let circlePadding = 10;

    let squarePadding = 10;

    let labelRotate = -90;

    let squareSize = barHeight * 0.3;

    // let yRange =
    //     catAttributes.length < 2
    //     ? [barHeight/2, barHeight/2]
    //     : [barHeight/4, barHeight*0.75];

    // let yScale = d3
    //   .scaleLinear()
    //   .domain([0, catAttributes.length - 1])
    //   .range(yRange);

    let format = d3.format("2.2s");

    let upperGroup = d3.select(".upperGroup");
    let lowerGroup = d3.select(".lowerGroup");

    let upperGroupElement;
    // let lowerGroupElement

    // draw nestedBars legend

    let bars = upperGroup
        .selectAll(".legendBar")
        //for each bar associate the relevant data from the parent node, and the attr name to use the correct scale
        .data(quantAttributes, d => d);

    let barsEnter = bars
        .enter()
        .append("g")
        .attr("class", "legendBar");

    barsEnter
        .append("rect")
        .attr("class", "frame")
        .append("title");

    barsEnter.append("rect").attr("class", "bar");
    barsEnter.append("text").attr("class", "legendLabel");
    barsEnter.append("text").attr("class", "domainEnd");

    bars.exit().remove();

    bars = barsEnter.merge(bars);

    bars.selectAll("rect").attr("width", barWidth);

    bars.attr("transform", (d, i) => {
        return "translate(" + i * (barWidth + barPadding) + ",0)";
    });

    bars
        .select(".frame")
        .attr("height", barHeight)
        .attr("y", -barHeight)
        .attr("x", 18)
        .style("stroke", d => scales[d].fill);

    bars
        .select(".bar")
        .attr("height", barHeight * 0.7)
        .attr("y", -barHeight * 0.7)
        .attr("x", 18)
        .style("fill", d => scales[d].fill);

    bars
        .select(".legendLabel")
        .text(d => config.attributeScales.node[d].label)
        // .attr("transform", "translate(" + barWidth/2 + "," + (-barHeight-5) +")")
        .attr("transform", "translate(10,0) rotate(" + labelRotate + ")")
        .style("text-anchor", "start")
        // .style("fill","white")
        .style("font-weight", "bold");
    // .style("font-size",barWidth/2)

    bars
        .select(".domainEnd")
        .text(d => format(config.attributeScales.node[d].domain[1]))
        // .attr("transform", "translate(" + (barWidth+3) + "," + (-barHeight+10) +")")
        .attr(
            "transform",
            "translate(" + (barWidth / 2 + 18) + "," + (-barHeight - 5) + ")"
        )
        .style("text-anchor", "middle");

    let catLegend = lowerGroup
        .selectAll(".catLegend")
        //for each bar associate the relevant data from the parent node, and the attr name to use the correct scale
        .data(catAttributes, d => d);

    let catLegendEnter = catLegend
        .enter()
        .append("g")
        .attr("class", "catLegend");

    // squaresEnter.append("rect").attr("class", "square");

    catLegendEnter.append("text").attr("class", "catLabel");
    catLegendEnter.append("g").attr("class", "categoricalScale");

    catLegend.exit().remove();

    catLegend = catLegendEnter.merge(catLegend);

    catLegend
        .select(".catLabel")
        .text(d => config.attributeScales.node[d].label)
        // .attr("transform", (d,i)=> "translate(0," + (yScale(i)+squareSize/4) +  ")")
        .attr("transform", (d, i) => "translate(0,0)")
        .style("font-weight", "bold")
        .style("text-anchor", "start");

    let catGlyphs = catLegend
        .select(".categoricalScale")
        .selectAll(".catGlyphs")
        .data((d, ii) =>
            config.attributeScales.node[d].domain.map(
                (domain, i) => {
                    return {
                        pos: ii,
                        attribute: d,
                        value: domain,
                        legendLabel: config.attributeScales.node[d].legendLabels[i],
                        fill: config.attributeScales.node[d].range[i]
                    };
                },
                d => d.attribute
            )
        );

    let catGlyphsEnter = catGlyphs
        .enter()
        .append("g")
        .attr("class", "catGlyphs");

    catGlyphsEnter.append("rect");
    catGlyphsEnter.append("text");

    catGlyphs.exit().remove();

    catGlyphs = catGlyphsEnter.merge(catGlyphs);

    catGlyphs.on("mouseover", function(d) {
        showTooltip(d.value)
    })

    catGlyphs.on("mouseout", function(d) {
        hideTooltip();
    })


    catGlyphs
        .select("rect")
        .attr("width", squareSize)
        .attr("height", squareSize)
        .attr("rx", d =>
            config.attributeScales.node[d.attribute].glyph === "square" ?
            0 :
            squareSize * 2
        )
        .attr("ry", d =>
            config.attributeScales.node[d.attribute].glyph === "square" ?
            0 :
            squareSize * 2
        )

    .attr("fill", d => d.fill);

    catGlyphs
        .select("text")
        .text(d => d.legendLabel)
        .attr(
            "transform",
            d => "translate(" + (squareSize + 3) + "," + squareSize / 2 + ")"
        )
        .style("text-anchor", "start");

    // .attr("transform",d=> "translate(" + (d.legendLabel.length<3?  0: squareSize) + "," + (d.pos === 0 ? -5 : d.legendLabel.length> 2 ? squareSize+5 : squareSize*1.7) + ") rotate(" + (d.legendLabel.length>2? labelRotate  : 0) + ")")
    // .style("text-anchor",d=>d.legendLabel.length>2 && d.pos === 1 ? "end":"start")

    // catGlyphs.attr("transform", (d, i) => {
    //   return "translate(" + i*(squareSize + squarePadding) + "," + (yScale(d.pos)-barHeight-squareSize/2) + ")";
    // });

    catGlyphs.attr("transform", (d, i) => {
        return "translate(0," + (i * (squareSize + squarePadding) + 10) + ")";
    });

    // catLegend.select('text')
    // .text(d=>d.value)
    // .attr("transform",d=> "translate(" + (squareSize+2) + "," + squareSize + ") rotate(0)")
    // // .style("text-anchor",d=>d.pos === 0 ? "start":"end")

    catLegend.attr("transform", (d, i) => {
        return "translate(" + i * 80 + ",0)";
    });

    //draw color/size legend

    let circles = upperGroup
        .selectAll(".legendBarCircles")
        //for each bar associate the relevant data from the parent node, and the attr name to use the correct scale
        .data(
            colorAttributeValues.map((c, i) => {
                return {
                    label: c,
                    fill: config.attributeScales.node[colorAttribute].range[i],
                    value: config.attributeScales.node[colorAttribute].domain[i],
                };
            })
        );

    let circlesEnter = circles
        .enter()
        .append("g")
        .attr("class", "legendBarCircles");

    circlesEnter.append("rect").attr("class", "circle");

    circlesEnter.append("text").attr("class", "legendLabel");

    circles.exit().remove();

    circles = circlesEnter.merge(circles);

    circles.attr("transform", (d, i) => {
        return "translate(" + i * (circleRadius + circlePadding) + ",0)";
    });

    circles
        .select(".circle")
        .attr("height", circleRadius)
        .attr("width", circleRadius)
        // .attr("y", -circleRadius-20)
        .style("fill", d => d.fill)
        .attr("rx", circleRadius)
        .attr("ry", circleRadius);

    circles
        .select(".legendLabel")
        .text(d => d.label)
        .attr(
            "transform",
            "translate(" + circleRadius / 2 + "," + (circleRadius / 2 + 5) + ")"
        )
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .style("fill", "white");

    circles.on("mouseover", function(d) {
        showTooltip(d.value)
    })

    circles.on("mouseout", function(d) {
        hideTooltip();
    })


    //render lower group in legend.

    let lowerLegendGroups = [];

    if (!drawBars && sizeAttribute) {
        lowerLegendGroups.push({
            label: config.attributeScales.node[sizeAttribute].label,
            domain: sizeAttributeValues,
            type: "node"
        })
    }

    if (edgeAttributeValues) {
        lowerLegendGroups.push({
            label: config.attributeScales.edge[edgeAttribute].label,
            domain: edgeAttributeValues,
            type: "edgeWidth"
        })
    }
    if (config.isMultiEdge) {
        lowerLegendGroups.push({
            label: config.attributeScales.edge.type.label,
            domain: edgeTypes,
            type: "edgeType"
        });
    }

    let node_link_legend = lowerGroup
        .selectAll(".node_link_legend")
        .data(lowerLegendGroups);

    let node_link_legendEnter = node_link_legend
        .enter()
        .append("g")
        .attr("class", "node_link_legend");

    node_link_legend.exit().remove();

    node_link_legend = node_link_legendEnter.merge(node_link_legend);

    //compute width of all .catLegend groups first:
    let catLegendWidth = 0;

    d3.selectAll(".catLegend").each(function() {
        catLegendWidth =
            catLegendWidth +
            d3
            .select(this)
            .node()
            .getBBox().width;
    });

    node_link_legend.attr(
        "transform",
        (d, i) =>
        "translate(" + (catLegendWidth + 20 + i * legend.width * 0.35) + ",0)"
    );

    //add label to each group

    let label = node_link_legend.selectAll(".axisLabel").data(d => [d.label]);

    let labelEnter = label
        .enter()
        .append("text")
        .attr("class", "axisLabel");

    label.exit().remove();

    label = labelEnter.merge(label);

    label.text(d => d.label);

    let sizeCircles = node_link_legend
        .selectAll(".sizeCircles")
        //for each bar associate the relevant data from the parent node, and the attr name to use the correct scale
        .data(d =>
            d.domain.map(domain => {
                return { data: domain, type: d.type };
            })
        );

    let sizeCirclesEnter = sizeCircles
        .enter()
        .append("g")
        .attr("class", "sizeCircles");

    sizeCirclesEnter.append("rect").attr("class", "sizeCircle");
    sizeCirclesEnter.append("text").attr("class", "sizeCircleLabel");

    sizeCircles.exit().remove();

    sizeCircles = sizeCirclesEnter.merge(sizeCircles);

    sizeCircles.attr("transform", (d, i) => {
        let radius = d.type === "node" ? 35 : d.type === "edgeType" ? 0 : 50;
        let yOffset = d.type === "edgeType" ? 50 : 0;
        return "translate(" + i * radius + "," + i * yOffset + ")";
    });



    let findCenter = function(i) {
        return circleScale.range()[1] / 2 - circleScale(i) / 2;
    };

    sizeCircles
        .select(".sizeCircle")
        .attr("height", (d, i) => d.type === "edgeType" ?
            edgeScale(1) :
            d.type === "edgeWidth" ?
            edgeScale(i) :
            circleScale(i)
        )
        .attr("width", (d, i) => (d.type === "node" ? circleScale(i) : 30))
        .attr("y", (d, i) =>
            d.type === "node" ?
            findCenter(i) + 5 :
            d.type === "edgeWidth" ?
            circleScale.range()[1] / 2 + 5 :
            circleScale.range()[1] / 2 - 5
        )
        .attr("rx", (d, i) => (d.type === "node" ? circleScale(i) : 0))
        .attr("ry", (d, i) => (d.type === "node" ? circleScale(i) : 0))
        .style("fill", d => (d.type === "edgeType" ? edgeStrokeScale(d.data) : ""))
        .classed("edgeLegend", (d, i) => d.type === "edgeType");

    sizeCircles
        .select(".sizeCircleLabel")
        .text(d => d.data)
        .attr(
            "transform",
            (d, i) =>
            "translate(" +
            (d.type === "node" ?
                circleScale(i) / 2 :
                d.type === "edgeWidth" ?
                edgeScale(i) :
                0) +
            "," +
            (d.type === "edgeType" ?
                circleScale.range()[1] / 2 + 20 :
                circleScale.range()[1] + 25) +
            ")"
        )
        .style("text-anchor", "start")
        .style("font-weight", "bold");

    node_link_legend
        .select(".axisLabel")
        .style("text-anchor", "start")
        .style("font-weight", "bold")
        .text(d => d.label)
        // .text(d=>{return config.attributeScales.node[d.label].label})
        // .attr('x',circleScale(sizeAttributeValues[1]))
        .attr("y", 0);

    //center group with circles;
    upperGroupElement = d3
        .select(".upperGroup")
        .node()
        .getBBox();
    lowerGroupElement = d3
        .select(".lowerGroup")
        .node()
        .getBBox();

    // d3.select('.upperGroup').attr("transform","translate(" + (legend.width/2 - upperGroupElement.width/2) + "," +  (drawBars ? barHeight + 20 : 10) + ")");
    // d3.select('.lowerGroup').attr("transform","translate(" + (legend.width/2 - lowerGroupElement.width/2) + "," +  (legend.height-10) + ")");

    // let longerLabel = 15;
    // d3.selectAll('.squareLabel').each(function(){
    //   longerLabel = d3.max([longerLabel,d3.select(this).node().getBBox().width+15]);
    //   })
    // let lowerTranslate = !drawBars ? 0 : longerLabel ;

    // console.log(longerLabel)
    d3.select(".upperGroup").attr(
        "transform",
        "translate(15," + (drawBars ? barHeight + 20 : 30) + ")"
    );
    d3.select(".lowerGroup").attr(
        "transform",
        "translate(0," + (drawBars ? upperGroupElement.height + 30 : 100) + ")"
    );
}