 var steps = [], nav = [], currentStep = 2, mainContentBounds;
 var atlasSG_histroy = []; //, stepsHistroy = [];
 var isGlyph=false, heightEncScale, widthEncScale;
 var gridGaps = {};
 
 function loadReuseUI() {
    d3.select("#refChart").html(d3.select("#rbox1").html());
    d3.select("#refChart").select("svg").attr("id", "refChartSVG");
    d3.select("#previewOriginal").html(d3.select("#rbox1").html());
    d3.select("#previewOriginal").select("svg").attr("id", "previewBg").style("opacity", 0.25);
    d3.select("#previewOriginal").selectAll("rect").remove();
    d3.select("#atlasCanvas").attr("viewBox", d3.select("#previewOriginal").select("svg").attr("viewBox")).attr("preserveAspectRatio", "xMinYMid");
    d3.select("#reuseOverlay").attr("viewBox", d3.select("#previewOriginal").select("svg").attr("viewBox")).attr("preserveAspectRatio", "xMinYMid");
    atlasRenderer.clear();
    atlasRenderer.render(atlasSceneGraph);
    //show layers
    let layers = [];
    enumerateLayers(atlasSceneGraph, layers, -1);

    //determine if axis exists for each layer
    let xAxisInfo = getAxisInfo("x"), yAxisInfo = getAxisInfo("y");
    let peerCounts = [];
    for (let i = 2; i < layers.length; i++) {
        peerCounts.push(atlasSceneGraph.getPeers(layers[i].item).length);
        //peerCounts.push(layers[i].item.parent.children.length);
    }
    let xIdx = findSubArray(peerCounts, xAxisInfo.map(d => d.count), 0),
        yIdx = findSubArray(peerCounts, yAxisInfo.map(d => d.count), 0);

    if (xAxis.labels.length > 0) {
        xAxis.orientation = xAxis.labels[0].y > atlasSceneGraph.bounds.bottom ? "bottom" : "top";
    }
    if (yAxis.labels.length > 0) {
        yAxis.orientation = yAxis.labels[0].x < atlasSceneGraph.bounds.left ? "left" : "right";
    }

    if (legend.labels.length > 0) {
        let bbox = calculateBBox(legend.labels);
        legend.relPos = {};
        if (legend.x + bbox.width < atlasSceneGraph.bounds.left) {
            legend.relPos.x = "left";
            legend.relPos.dx = (legend.x + bbox.width) - atlasSceneGraph.bounds.left;
        } else if (legend.x > atlasSceneGraph.bounds.right) {
            legend.relPos.x = "right";
            legend.relPos.dx = legend.x - atlasSceneGraph.bounds.right;
        }
        if (legend.y + bbox.height < atlasSceneGraph.bounds.top) {
            legend.relPos.y = "top";
            legend.relPos.dy = (legend.y + bbox.height) - atlasSceneGraph.bounds.top;
        } else if (legend.y > atlasSceneGraph.bounds.bottom) {
            legend.relPos.y = "bottom";
            legend.relPos.dy = legend.y - atlasSceneGraph.bounds.bottom;
        }
    }
    
    if (xIdx >= 0) {
        for (let i = 0; i < xAxisInfo.length; i++) {
            layers[i + 2 + xIdx].xAxis = xAxisInfo[i].axis;
            layers[i + 2 + xIdx].axisLevel = xAxisInfo.length - i;
            //layers[i + 2 + xIdx].xAxis.orientation = xAxisInfo[i].axis.labels[0].y > atlasSceneGraph.bounds.bottom ? "bottom" : "top";
        }
    }
    if (yIdx >= 0) {
        for (let i = 0; i < yAxisInfo.length; i++) {
            layers[i + 2 + yIdx].yAxis = yAxisInfo[i].axis;
            layers[i + 2 + yIdx].axisLevel = yAxisInfo.length - i;
            //layers[i + 2 + yIdx].yAxis.orientation = yAxisInfo[i].axis.labels[0].x < atlasSceneGraph.bounds.left ? "left" : "right";
        }
    }
    //console.log(xIdx, yIdx, layers.map(d=>d.xAxis), layers.map(d=> d.yAxis));

    showLayers(layers);
    steps = [];
    nav = [];

    let numRectsWithinGlyph = 1;
    for (let l of layers) {
        steps.push({"task": "join", "item": l.item.id, "type": l.item.type == "rect" ? "rect" : "group", "xAxis": l.xAxis, "yAxis": l.yAxis, "axisLevel": l.axisLevel});
        if (l.item.type === "glyph") {numRectsWithinGlyph = layers.length - layers.indexOf(l) - 1; isGlyph = true; widthEncScale = undefined; heightEncScale = undefined; break;}
        else isGlyph = false;
    }
    for (let l of layers) {
        console.log(l.item)
        if (l.item.type == "collection" && l.item.layout && l.item.layout.type == "treemap" && l.item.children[0] && !l.item.bottomTreeInd) {
            let peers = atlasSceneGraph.getPeers(l.item);
            let widths = peers.map(d => parseInt(d.bounds.width)).filter(onlyUnique), heights = peers.map(d => parseInt(d.bounds.height)).filter(onlyUnique);
            if (widths.length > 1) {
                let o = {"task": "encode", "item": l.item.id, "channel": "width"};
                steps.push(o);
                // steps.splice(-1, 0, o);
            }
            if (heights.length > 1) {
                let o = {"task": "encode", "item": l.item.id, "channel": "height"};
                if (yIdx < 0 && yAxis) {
                    o.yAxis = yAxisInfo[0].axis;
                }
                steps.push(o);
                // steps.splice(-1, 0, o);
            }
        }
    }

    for (let i = chartDecomposition.encodings.length - 1; i >= 0; i--) {
        if (i === chartDecomposition.encodings.length - 1 && isGlyph) {
            for (let j = numRectsWithinGlyph; j >=  1; j--) {
                for (let c of chartDecomposition.encodings[i][numRectsWithinGlyph - j]) {
                    let o = {"task": "encode", "item": layers[layers.length - 1 - (chartDecomposition.encodings.length -1 - i) - (j - 1)].item.id, "channel": c};
                    steps.push(o);
                }
            }
        } else {
            for (let c of chartDecomposition.encodings[i]) {
                let o = {"task": "encode", "item": layers[layers.length - 1 - (chartDecomposition.encodings.length -1 - i)].item.id, "channel": c};
                steps.push(o);
            }
        }
    }
    for (let a of chartDecomposition.alignments) {
        let layout = layers[layers.length-2].item.layout;
        if (a[0] == "customized" && layout.type == "stack") {
            steps.push({"task": "align", "dir": layout.orientation, "item": layers[layers.length-1].item.id});
        }
    }

    if (xIdx < 0 && !hasAxisRelatedEncoding("x")) {
        //change grid layout to x encoding
        for (let i = 2; i < steps.length; i++) {
            if (steps[i].task == "join" && steps[i+1].task == "encode") {
                steps.splice(i+1, 0, {"task": "encode", "item": steps[i].item, "channel": "x"});
                atlasSceneGraph.getItem(steps[i-1].item).layout = undefined;
                break;
            }
        }
    }

    for (let i = 2; i < steps.length; i++) {
        if (steps[i].task == "join") {
            nav.push(steps[i].type);
        } else if (steps[i].task == "encode") {
            nav.push(["x", "y", "width", "height"].indexOf(steps[i].channel) >= 0 ? "position / size" : steps[i].channel);
        } else if (steps[i].task == "align") {
            nav.push(steps[i].task);
        }
    }

    // let btns = d3.select("#navigation").append("div").style("position","absolute").style("top", "0px")
    //                 .style("right", "0px").style("font-size", "15px");
    d3.select("#navigation").selectAll("*").remove();
    let bcDiv = d3.select("#navigation").append("div");
    // bcDiv.append("b").text("Navigation: ").style("margin-top", "0px").style("margin-bottom", "0px").style("margin-right", "15px"); // adding name for this navigation panel
    bcDiv.append("button").attr("id", "backBtn").style("margin-right", "15px").style("font-size", "13.5px")
        .property("disabled", currentStep<=2).text("Back").on("click", goBack);
    
    for (let i = 0; i < nav.length; i++) {
        bcDiv.append("div").attr("id", "bc"+i).attr("class", "bc").style("display", "inline-block").style("font-size", "12.5px")
            .style("margin-left", "10px").style("margin-right", "10px").text(nav[i] == "y" ? "middle" : nav[i]);
        if (i != nav.length - 1)
            bcDiv.append("div").style("display", "inline-block").style("color", "#aaa").html("&#187;");
    }
    
    bcDiv.append("button").attr("id", "nextBtn").style("margin-left", "15px").style("margin-right", "5px").style("font-size", "13.5px")
        .property("disabled", true)
        .text("Next").on("click", goNext);

    currentStep = 2;
    mainContentBounds = atlasSceneGraph.getItem(steps[1].item).bounds.clone();
    recordCurrentState();

    console.log(steps)

    if (atlasTbl)
        updateDialog();
}

function hasAxisRelatedEncoding(xy) {
    let channels = xy == "x" ? ["left", "x", "right", "width"] : ["top", "y", "bottom", "height"];
    for (let i = 2; i < steps.length; i++) {
        if (steps[i].task == "encode" && channels.indexOf(steps[i].channel) >=0 )
            return true;
    }
    return false;
}

function getAxisInfo(o) {
    let axisInfo = [], axis = o == "x" ? xAxis : yAxis;
    if (axis) {
        if (axis.labels.length > 0) {
            if (axis.upperLevels) {
                for (let level of axis.upperLevels) {
                    axisInfo.unshift({count: level.length, axis: axis});
                }
            }
            axisInfo.push({count: axis.labels.length, axis:axis});
        }
    }
    return axisInfo;
}

function getEncodableFields(channel) {
    let fTypes = [];
    switch(channel) {
        case "x":
        case "y":
            fTypes.push("number");
            fTypes.push("string");
            fTypes.push("date");
            break;
        case "width":
        case "left":
        case "right":
            // if (xAxis)
            //     fTypes.push(xAxis.fieldType);
            // else {
                fTypes.push("number");
                fTypes.push("date");
            // }
            break;
        case "height":
        case "top":
        case "bottom":
            // if (yAxis)
            //     fTypes.push(yAxis.fieldType);
            // else {
                fTypes.push("number");
                fTypes.push("date");
            // }
            break;
        case "fill":
            if (legend.labels.length > 0) {
                if (legend.type == "discrete") {
                    fTypes.push("string");
                } else {
                    fTypes.push("number");
                    fTypes.push("date");
                }
            } else {
                fTypes.push("number");
                fTypes.push("string");
                fTypes.push("date");
            }
            break;
        default:
            fTypes.push("number");
            fTypes.push("string");
            fTypes.push("date");
            break;
    }
    let result = [];
    for (let f of fTypes) {
        if (f === "number")
            result = result.concat(atlasTbl.numericFields);    
        else if (f === "string") {
            result = result.concat(atlasTbl.getFieldsByType(f).sort((a, b) => atlasTbl.getUniqueFieldValues(a).length - atlasTbl.getUniqueFieldValues(b).length));
        } else {
            result = result.concat(atlasTbl.getFieldsByType(f));
        }
    }
    return result;
}

function recreateLegend(field) {
    atlasSceneGraph.removeAllItemsByType("legend");
    let args = {showTitle: false};
    let collectionBounds = atlasSceneGraph.children.filter(d => d.type == "collection")[0].bounds;
    if (legend.labels.length > 0) {
        let x, y;
        if (legend.relPos.x) {
            x = collectionBounds[legend.relPos.x] + legend.relPos.dx;
        } else {
            x = collectionBounds.center;
        }
        if (legend.relPos.y) {
            y = collectionBounds[legend.relPos.y] + legend.relPos.dy;
        } else {
            y = collectionBounds.top;
        }
        args.x = x;
        args.y = y;
    } else {
        args.x = collectionBounds.right + 30;
        args.y = collectionBounds.top;
    }
    let ft = atlasTbl.getFieldType(field), lgd;
    if (ft == "integer" || ft == "number") {
        args.orientation = legend.orientation == "horz" ? "horizontal" : "vertical";
        lgd = atlasSceneGraph.legend("fillColor", field, args);
    } else {
        if (legend.orientation == "horz")
            args.numRows = 1;
        else
            args.numCols = 1;
        lgd = atlasSceneGraph.legend("fillColor", field, args);
    }
    if (legend.labels.length > 0) {
        let dx = 0, dy = 0;
        if (!legend.relPos.x) {
            dx = - lgd.bounds.width/2;
        }
        atlasSceneGraph.translate(lgd, dx, dy);
    } 
}

function applyEncoding(step, c, field) {
    let item = atlasSceneGraph.getItem(step.item), channel = c;
    if (item.type == "collection" && item.layout && item.layout.type == "treemap") {
        // let peers = atlasSceneGraph.getPeers(item);
        // let data = peers.map(d => d.dataScope.aggregateNumericalField(field, "sum"));
        // let scale = d3.scaleLinear([0, d3.max(data)], [0, mainContentBounds[c]]);
        // let sizes = data.map(d => scale(d));
        // if (c == "width") {
        //     peers.forEach((d,i) => d.layout.width = sizes[i]);
        // } else if (c == "height") {
        //     peers.forEach((d,i) => d.layout.height = sizes[i]);
        // }
        // atlasSceneGraph._relayoutAncestors(item, peers);
        let args = {channel: getAtlasChannel(channel), field: field};
        atlasSceneGraph.encode(item, args);
        step.field = field;        
    } else {
        if (["left", "right", "top", "bottom", "center", "middle"].indexOf(channel) >= 0) {
            switch (channel) {
                case "left":
                    item = item.leftSegment;
                    channel = "x";
                    break;
                case "right":
                    item = item.rightSegment;
                    channel = "x";
                    break;
                case "top":
                    item = item.topSegment;
                    channel = "y";
                    break;
                case "bottom":
                    item = item.bottomSegment;
                    channel = "y";
                    break;
                case "center":
                    channel = "x";
                    break;
                case "middle":
                    channel = "y";
                    break;
            }
        }
        
        let enc = atlasSceneGraph.getEncodingByItem(item, channel === "fill" ? "fillColor" : channel);
        if (enc)
            atlasSceneGraph.removeEncoding(enc);
    
        let args = {channel: getAtlasChannel(channel), field: field};
        if (channel == "fill") {
            let values = atlasTbl.getUniqueFieldValues(field);
            if (legend.labels.length > 0) {
                if (legend.type == "discrete") {
                    let colors = Object.values(legend.mapping);
                    if (values.length > colors.length) {
                        colors = values.length <= 10 ? d3.scaleOrdinal(d3.schemeCategory10).range() : d3.scaleOrdinal(d3.schemePaired).range();
                    }
                    let mapping = {};
                    for (let i = 0; i < values.length; i++) {
                        mapping[values[i]] = colors[i%colors.length];
                    }
                    args.mapping = mapping;
                } else { //continuous
                    let colors = legend.colors;
                    values.sort();
                    let interval = (d3.max(values) - d3.min(values))/(legend.labels.length - 1);
                    let mapping = {};
                    for (let i = 0; i < legend.labels.length; i++) {
                        let c = colors[i%colors.length];
                        mapping[d3.min(values) + i * interval] = d3.rgb(c[0], c[1], c[2], c[3]);
                    }
                    args.mapping = mapping;
                }
            } else {
                let ft = atlasTbl.getFieldType(field);
                if (ft == "integer" || ft == "number") {
                    //todo: get continuous color mapping
                } else {
                    let colors = mainContent.rects.map(rect => rect["fill"]).filter(onlyUnique).filter(f => f != "none");
                    let mapping = {};
                    for (let i = 0; i < values.length; i++) {
                        mapping[values[i]] = colors[i%colors.length];
                    }
                    args.mapping = mapping;
                }
            }
        }
        
    
        //check if reusing scale
        if (c == "top" || c == "bottom") {
            let seg = c == "top" ? atlasSceneGraph.getItem(step.item).bottomSegment : atlasSceneGraph.getItem(step.item).topSegment;
            let renc = atlasSceneGraph.getEncodingByItem(seg, "y");
            if (renc) args.scale = renc.scale;
        } else if (c == "left" || c == "right") {
            let seg = c == "right" ? atlasSceneGraph.getItem(step.item).leftSegment : atlasSceneGraph.getItem(step.item).rightSegment;
            let renc = atlasSceneGraph.getEncodingByItem(seg, "x");
            if (renc) args.scale = renc.scale;
        }
        enc = atlasSceneGraph.encode(item, args);
        if (field === "DayOfWeek") {
            enc.scale.domain = ["Sat", "Fri", "Thu", "Wed", "Tue", "Mon", "Sun"];
        }
        if (channel == "width" || channel == "height") {
            if (atlasSceneGraph.getItem(steps[1].item).layout) {
                let actualSize = atlasSceneGraph.getItem(steps[1].item).bounds[channel];
                enc.scale.rangeExtent = enc.scale.rangeExtent * mainContentBounds[channel]/actualSize;
            } else if (atlasTbl.getFieldType(field) == "number") {
                let vals = atlasTbl.getUniqueFieldValues(field).filter(d => d < 0);
                if (vals.length > 0)
                    enc.scale.rangeExtent = enc.scale.rangeExtent * 3;
            }
        }
        if (isGlyph) {
            switch (channel) {
                case "width":
                case "x":
                    if (!widthEncScale) widthEncScale = enc.scale;
                    else enc.scale.rangeExtent = widthEncScale.rangeExtent / widthEncScale.domain[1] * enc.scale.domain[1];
                    if (channel == "x") enc.scale.domain = [0, enc.scale.domain[1]];
                    break;
                case "height":
                case "y":
                    if (!heightEncScale) heightEncScale = enc.scale;
                    else enc.scale.rangeExtent = heightEncScale.rangeExtent / heightEncScale.domain[1] * enc.scale.domain[1];
                    if (channel == "y") enc.scale.domain = [0, enc.scale.domain[1]];
                    break;
            }
        }
        let glyphCheck = item.parent.type !== "glyph" && item.parent.parent.type !== "glyph";
        if ((channel == "x" || channel == "y") && glyphCheck) {
            if (item.parent.classId in gridGaps) {
                enc.scale.rangeExtent = (atlasTbl.getUniqueFieldValues(field).length - 1) * (item.bounds[channel == "x" ? "width" : "height"] + gridGaps[item.parent.classId]);
            } else {
                enc.scale.rangeExtent = mainContentBounds[channel == "x" ? "width" : "height"];
            }
        }

        step.channel = c;
        step.field = field;
        if (["width", "left", "right", "x"].indexOf(channel) >= 0 && xAxis && xAxis.labels.length > 0 && xAxis.fieldType == typeByAtlas(atlasTbl.getFieldType(field))) {
            step.xAxis = xAxis;
            //step.xAxis.orientation = xAxis.labels[0].y + xAxis.labels[0].height > atlasSceneGraph.bounds.bottom ? "bottom" : "top";
        }
        if (["height", "top", "bottom", "y"].indexOf(channel) >= 0 && yAxis && yAxis.labels.length > 0 && yAxis.fieldType == typeByAtlas(atlasTbl.getFieldType(field))) {
            step.yAxis = yAxis;
            //step.yAxis.orientation = yAxis.labels[0].x < atlasSceneGraph.bounds.left ? "left" : "right";
        }        
    }
    
    highlightItem(atlasSceneGraph.getItem(step.item), 0.3);
    
    recreateAxes(currentStep);
    if (getEncoding("fillColor"))
        recreateLegend(getEncoding("fillColor").field);
    
    atlasRenderer.render(atlasSceneGraph);

    let bounds = atlasSceneGraph.bounds, margin = 15;
    d3.select("#atlasCanvas").attr("viewBox", [bounds.left - margin, bounds.top - margin, bounds.width + margin * 2, bounds.height + margin * 2].join(" "));
    d3.select("#reuseOverlay").attr("viewBox", [bounds.left - margin, bounds.top - margin, bounds.width + margin * 2, bounds.height + margin * 2].join(" "));

}

function getEncoding(channel) {
    for (let itmKey in atlasSceneGraph.encodings) {
        let enc = atlasSceneGraph.encodings[itmKey];
        if (enc[channel])
            return enc[channel];
    }
    return null;
}

function recordCurrentState() {
    let exe = atlas.sceneLoader();
    //to deal with dates, need to stringify then parse
    let json = JSON.parse(JSON.stringify(atlasSceneGraph.toJSON()));
    // console.log("scene", atlasSceneGraph);
    // console.log("json", json);
    let thisAtlasSG = exe.load(json);
    atlasSG_histroy.push(thisAtlasSG);
}

function goNext() {
    updateBreadCrumb();
    recordCurrentState();
    //stepsHistroy.push([...steps]);
    currentStep++;
    updateDialog();
}

function goBack() {
    currentStep--;
    atlasSceneGraph = atlasSG_histroy.pop();
    atlasTbl = atlasSceneGraph.getDataTables()[atlasTbl.id];
    atlasRenderer.render(atlasSceneGraph);
    //steps = stepsHistroy.pop();
    updateDialog();
}

function updateBreadCrumb() {
    if (steps[currentStep].task == "encode") {
        let c = steps[currentStep].channel;
        if (c == "y") c = "middle";
        if (c == "x") c = "center";
        d3.select("#bc"+(currentStep-2)).text([c, " (", steps[currentStep].field, ")"].join(""));
    } else if (steps[currentStep].task == "join") {
        d3.select("#bc"+(currentStep-2)).text(nav[currentStep-2] + " (" + steps[currentStep].field + ")");
    }
}

function encodingChoiceChanged(step, e) {
    let channel = d3.select("#cnlFieldSelect").property("value");
    if (["top", "bottom", "left", "right"].indexOf(channel) >= 0 && e) {
        let conflict = channel == "top" ? "bottom" : channel == "bottom" ? "top" : channel == "left" ? "right" : "left";
        for (let i = 2; i < currentStep; i++) {
            if (steps[i].task != "encode") continue;
            if (steps[i].channel == conflict) {
                let f = steps[i].field;
                let fields = getEncodableFields(steps[i].channel).filter(d => d != f);
                d3.select("#encFieldSelect").selectAll("option").remove();
                d3.select("#encFieldSelect").selectAll("option").data(fields).enter().append("option").text(d => d);
            }
        }
    }

    let sg = atlasSG_histroy[atlasSG_histroy.length - 1];
    let exe = atlas.sceneLoader();
    let json = JSON.parse(JSON.stringify(sg));
    atlasSceneGraph = exe.load(json);
    atlasTbl = atlasSceneGraph.getDataTables()[atlasTbl.id];
    applyEncoding(step, d3.select("#cnlFieldSelect").property("value"), d3.select("#encFieldSelect").property("value"));
}

function joinChoiceChanged(step, e) {
    let field = d3.select("#joinSelect").property("value");
    let sg = atlasSG_histroy[atlasSG_histroy.length - 1];
    let exe = atlas.sceneLoader();
    let json = JSON.parse(JSON.stringify(sg));
    atlasSceneGraph = exe.load(json);
    if (atlasSceneGraph.getDataTables()[atlasTbl.id]) {
        atlasTbl = atlasSceneGraph.getDataTables()[atlasTbl.id];
    }
    if (field != "") {
        applyJoin(step, field);
        d3.select("#nextBtn").property("disabled", false);
    }
}

function applyJoin(step, field) {
    if (currentStep == 2)
        unifyRectSize();
    let item = atlasSceneGraph.getItem(step.item);
    atlasSceneGraph.repopulate(item, atlasTbl, {field: field});  
    step.field = field;
    // if (steps[currentStep].xAxis)
    //     updateAxis(item, col, "x", steps[currentStep].xAxisBaseline);
    // if (steps[currentStep].yAxis)
    //     updateAxis(item, col, "y", steps[currentStep].yAxisBaseline);
    recreateAxes(currentStep);
    atlasRenderer.render(atlasSceneGraph);

    let bounds = atlasSceneGraph.bounds, margin = 15;
    d3.select("#atlasCanvas").attr("viewBox", [bounds.left - margin, bounds.top - margin, bounds.width + margin * 2, bounds.height + margin * 2].join(" "));
    d3.select("#reuseOverlay").attr("viewBox", [bounds.left - margin, bounds.top - margin, bounds.width + margin * 2, bounds.height + margin * 2].join(" "));
    highlightItem(item, 0.3);
}

function alignmentChanged(step) {
    let sg = atlasSG_histroy[atlasSG_histroy.length - 1];
    let exe = atlas.sceneLoader();
    let json = JSON.parse(JSON.stringify(sg));
    atlasSceneGraph = exe.load(json);
    atlasTbl = atlasSceneGraph.getDataTables()[atlasTbl.id];
    applyAlignment(step, d3.select("#fieldValueSelect").property("value"), d3.select("#anchorSelect").property("value"));
}

function getChannelDisplayName(c) {
    switch (c) {
        case "x":
            return "x position";
        case "y":
            return "y position";
        case "top":
        case "bottom":
        case "left":
        case "right":
            return c + " side";
        default:
            return c;
    }
}

function applyAlignment(step, val, anchor) {
    // atlasSceneGraph.removeAllConstraints();
    let rects = atlasSceneGraph.find([{field: step.field, value: val}]);
    rects = rects.filter(d => d.type == "rect");
    atlasSceneGraph.align(rects, anchor);
    recreateAxes(currentStep);
    if (getEncoding("fillColor"))
        recreateLegend(getEncoding("fillColor").field);
    atlasRenderer.render(atlasSceneGraph);
    let bounds = atlasSceneGraph.bounds, margin = 15;
    d3.select("#atlasCanvas").attr("viewBox", [bounds.left - margin, bounds.top - margin, bounds.width + margin * 2, bounds.height + margin * 2].join(" "));
    d3.select("#reuseOverlay").attr("viewBox", [bounds.left - margin, bounds.top - margin, bounds.width + margin * 2, bounds.height + margin * 2].join(" "));
}

function exportAsDI () {
    let file = new Blob([JSON.stringify(atlasSceneGraph.toJSON())], {
        type: "application/json",
        name: "vis.alscn"
    })
    saveAs(file, "vis.alscn");
}
 
function updateDialog() {
    highlightItem();
    d3.select("#instruction").selectAll("*").remove();
    d3.selectAll(".bc").style("color", "#ccc");
    for (let i = 2; i <= currentStep; i++) {
        d3.select("#bc"+(i-2)).style("color", "#555");
    }
    if (currentStep >= steps.length) {
        d3.select("#instruction").append("div").style("display", "inline-block").text("You are done!");
        d3.select("#nextBtn").property("disabled", true);
        if (atlasSceneGraph)
            atlasRenderer.render(atlasSceneGraph);
        d3.select("#instruction").append("button").attr("id", "exportBtn").style("margin-left", "15px").style("font-size", "13.5px")
            .text("Export").on("click", exportAsDI);
        return;
    }
    let step = steps[currentStep], l = atlasSceneGraph.getItem(step.item), type = l.children ? "group" : "rectangle";
    if (step.task === "join") {
        d3.select("#instruction").append("div").style("display","inline-block").text("The highlighted " + type + " should represent ");
                //.text("Tell us what the highlighted " + type +  " should represent by dragging and dropping a value from the data table");
        let fields = atlasTbl.getFieldsByType("string").concat(atlasTbl.getFieldsByType("date")).concat(["atlas_rowId"]);
        //let intFields = atlasTbl.getFieldsByType("integer").filter(d => atlasTbl.getUniqueFieldValues(d).length < 100);
        //fields = fields.concat(intFields);
        let usedFields = [];
        for (let i = 2; i < currentStep; i++)
            usedFields.push(steps[i].field);
        fields = fields.filter(d => usedFields.indexOf(d) < 0);
        fields.sort((a, b) => atlasTbl.getUniqueFieldValues(a).length - atlasTbl.getUniqueFieldValues(b).length);
        //let values = fields.map(d => atlasTbl.data[0][d] + " (" + (d == "atlas_rowId" ? "row ID" : d) + ")");
        let joinSelect = d3.select("#instruction").append("select").attr("id", "joinSelect").style("font-size", "15px").style("margin-right", "10px").style("margin-left", "10px")
            .on("change", (e) => joinChoiceChanged(step, e));
        joinSelect.selectAll("option").data([""].concat(fields)).enter().append("option").attr("value", d => d)
                .text(d => d == "" ? "" : atlasTbl.getRawValue(d, atlasTbl.data[0][d]) + " (" + (d == "atlas_rowId" ? "row ID" : d) + ")");
        if (step.field){
            joinSelect.property("value", step.field);
            joinChoiceChanged(step);
        }
        l = atlasSceneGraph.getItem(step.item);
        highlightItem(l, 0.3);
        d3.select("#backBtn").property("disabled", currentStep == 2);
    } else if (step.task === "encode") {
        d3.select("#instruction").append("div").style("display","inline-block").text("The ");
        let channel = step.channel, relatedChannels = channelGroups.find(d => d.indexOf(channel) >= 0);
        // if (channel !== "width" && channel !== "height" && isGlyph) 
        //     relatedChannels = relatedChannels.map(c => c=="height" ? "middle" : c=="width" ? "center" : c); // better handle this later
        let cnlSelect = d3.select("#instruction").append("select").attr("id", "cnlFieldSelect").style("font-size", "15px").style("margin-right", "10px").style("margin-left", "10px")
                            .on("change", (e) => encodingChoiceChanged(step, e));
        cnlSelect.selectAll("option").data(relatedChannels).enter().append("option").attr("value", d => d).text(d => getChannelDisplayName(d));
        cnlSelect.property("value", channel);
        d3.select("#instruction").append("div").style("display","inline-block").text(type.startsWith("rect") && isGlyph ? " of this " + type +  " in every group should represent " : " of each " + type +  " should represent ");
        let fieldSelect = d3.select("#instruction").append("select").attr("id", "encFieldSelect").style("font-size", "15px").style("margin-right", "10px").style("margin-left", "10px").property("disabled", false)
                            .on("change", (e) => encodingChoiceChanged(step));
        let fields = getEncodableFields(channel);
        fieldSelect.selectAll("option").data(fields).enter().append("option").text(d => d);
        if (step.field) {
            fieldSelect.property("value", step.field);
        }
        // applyEncoding(step, d3.select("#cnlFieldSelect").property("value"), d3.select("#encFieldSelect").property("value"));
        // recordCurrentState();
        encodingChoiceChanged(step);
        //fieldSelect.property("value", channel);
        l = atlasSceneGraph.getItem(step.item);
        highlightItem(l, 0.3);
        d3.select("#nextBtn").property("disabled", false);
        d3.select("#backBtn").property("disabled", false);
    } else if (step.task == "align") {
        d3.select("#instruction").append("div").style("display","inline-block").text("Rectangles representing ");
        let lFields = l.dataScope.fields, pFields = l.parent.dataScope.fields;
        let fields = lFields.filter(d => pFields.indexOf(d) < 0);
        //let channel = step.channel, relatedChannels = channelGroups.find(d => d.indexOf(channel) >= 0);
        let valSelect = d3.select("#instruction").append("select").attr("id", "fieldValueSelect").style("margin-right", "10px").style("margin-left", "10px")
                             .on("change", (e) => alignmentChanged(step));
        valSelect.selectAll("option").data(atlasTbl.getUniqueFieldValues(fields[0])).enter().append("option").text(d => d);
        // cnlSelect.property("value", channel);
        d3.select("#instruction").append("div").style("display","inline-block").text(" are aligned to the ");
        let anchorSelect = d3.select("#instruction").append("select").attr("id", "anchorSelect").style("margin-right", "10px").style("margin-left", "10px").property("disabled", false)
                             .on("change", (e) => alignmentChanged(step));
        let anchors = step.dir == "horizontal" ? ["left", "center", "right"] : ["top", "middle", "bottom"];
        anchorSelect.selectAll("option").data(anchors).enter().append("option").text(d => d);
        step.field = fields[0];
        alignmentChanged(step);
        d3.select("#nextBtn").property("disabled", false);
        d3.select("#backBtn").property("disabled", false);
        // applyAlignment(step, d3.select("#fieldValueSelect").property("value"), d3.select("#anchorSelect").property("value"));
        // recordCurrentState();
        // //fieldSelect.property("value", channel);
        // highlightItem(l, 0.3);
    }
    
}

var channelGroups = [
    ["left", "width", "right"],
    ["top", "height", "bottom"],
    ["x", "left", "right"],
    ["y", "top", "bottom"],
    ["fill"],
    ["stroke"],
    ["area"]
]

function getAxisArgs(step, channel) {
    let axis = ["x", "width", "left", "right"].indexOf(channel) >= 0 ? step.xAxis : step.yAxis;
    let axisArgs = {};
    if (axis.ticks && axis.ticks.length > 0) {
        axisArgs.tickVisible = true;
        //find ticks
        let ft = atlasTbl.getFieldType(step.field), vals = atlasTbl.getUniqueFieldValues(step.field);
        let tickValues = [];
        if (ft == "date" || ft == "string") {
            for (let i = 0; i < axis.ticks.length; i++)
                tickValues.push(vals[i * Math.floor(vals.length/axis.ticks.length)]);
            axisArgs.tickValues = tickValues;
        } else {
            // for (let i = 0; i < axis.ticks.length; i++)
            //     tickValues.push(d3.min(vals) + (d3.max(vals) - d3.min(vals))*i/axis.ticks.length);
        }
    } else {
        axisArgs.tickVisible = false;
    }
    axisArgs.pathVisible = axis.path ? parseFloat(axis.path["stroke-opacity"] ? axis.path["stroke-opacity"] : '1') != 0 : false;
    axisArgs.showTitle = "title" in axis;
    if (axisArgs.pathVisible) axisArgs.strokeColor = axis.path.stroke;
    if ("axisLevel" in step) {
        axisArgs.labelOffset = 20 * step.axisLevel;
    }
    // let o;
    // if (channel == "x" || channel == "width") {
    //     o = axis.labels[0].y > atlasSceneGraph.getItem(step.item).bounds.bottom ? "bottom" : "top";
    // } else {
    //     o = axis.labels[0].x < atlasSceneGraph.getItem(step.item).bounds.left ? "left" : "right";
    // }
    axisArgs.orientation = axis.orientation;
    if (atlasTbl.getFieldType(step.field) == "date") {
        axisArgs.labelFormat = "%m/%d";
    }
    return axisArgs;
}

function createAxis(info, xy) {
    let item = atlasSceneGraph.getItem(info.item);
    let axisArgs = getAxisArgs(info, xy ? xy : info.channel);
    if (xy != "x" && xy != "y") {
        let c = ["top", "bottom"].indexOf(info.channel) >=0 ? "y" : ["left", "right"].indexOf(info.channel) >= 0 ? "x" : info.channel;
        atlasSceneGraph.axis(c, info.field, axisArgs);
        return;
    }
    if (item.parent && item.parent.layout) {
        let pl = item.parent.layout;
        if (pl.type === "grid") {
            //previously it's item.parent, changed to item for D3-12
            axisArgs.item = item;
            if (xy == "x" && pl.numRows == 1) {
                atlasSceneGraph.axis("x", info.field, axisArgs);
            } else if (xy == "y" && pl.numCols == 1) {
                atlasSceneGraph.axis("y", info.field, axisArgs);
            }
        } else if (pl.type === "stack") {
            if (xy == "x" && pl.orientation === "horizontal") {
                atlasSceneGraph.axis("x", info.field, axisArgs);
            } else if (xy == "y" && pl.orientation === "vertical") {
                atlasSceneGraph.axis("y", info.field, axisArgs);
            }
        }
    } else {
        let gp = item.parent.parent;
        if (gp && gp.layout && gp.layout.type == "grid") {
            let parents = gp.children;
            for (let p of parents) {
                let args = Object.assign({}, axisArgs);
                args.item = p.firstChild;
                atlasSceneGraph.axis(xy, info.field, args);
            }
        }
    }
}

function recreateAxes(currentStep) {
    d3.select("#previewOriginal").selectAll("*").remove();
    atlasSceneGraph.removeAllItemsByType("axis");
    atlasSceneGraph.removeAllItemsByType("gridlines");
    let channelX = false, channelY = false;
    for (let i = 2; i <= currentStep; i++) {
        if (steps[i].xAxis) {
            if (steps[i].channel && channelX) continue;
            createAxis(steps[i], steps[i].channel ? steps[i].channel : "x");
            if (steps[i].channel) {
                channelX = true;
                if (xGridlines)
                    atlasSceneGraph.gridlines(steps[i].channel == "width" ? "width" : "x", steps[i].field);
            }
        }
        if (steps[i].yAxis) {
            if (steps[i].channel && channelY) continue;
            createAxis(steps[i], steps[i].channel ? steps[i].channel : "y");
            if (steps[i].channel) {
                channelY = true;
                if (yGridlines) {
                    atlasSceneGraph.gridlines(steps[i].channel == "height" ? "height" : "y", steps[i].field);
                }
            }
        }
    }
}

function unifyRectSize() {
    let wd = [atlasSceneGraph.getItem(steps[1].item).bounds.width], ht = [atlasSceneGraph.getItem(steps[1].item).bounds.height];
    
    for (let i = currentStep; i < steps.length; i++) {
        if (steps[i].task != "join")
            if (atlasSceneGraph.getItem(steps[i].item).parent.type !== "glyph")
                break;
        let item = atlasSceneGraph.getItem(steps[i].item);
        if (!item) return;
        if (item.parent && item.parent.layout) {
            let parent = item.parent, layout = item.parent.layout;
            if (layout.type == "grid") {
                wd.push((wd[i-2] - layout.colGap * (layout.numCols - 1))/layout.numCols);
                ht.push((ht[i-2] - layout.rowGap * (layout.numRows - 1))/layout.numRows);
            } else if (layout.type == "stack") {
                let o = layout.orientation;
                wd.push(o == "horizontal" ? wd[i-2]/parent.children.length : wd[i-2]);
                ht.push(o == "vertical" ? ht[i-2]/parent.children.length : ht[i-2]);
            }
        } else if (item.parent.type == "glyph") {
            let peers = atlasSceneGraph.getPeers(item);
            wd.push(average(peers.map(r => r.width)));
            ht.push(average(peers.map(r => r.height)));
            if (["x", "left", "center", "right"].includes(steps[i].channel)) {
                let baseline = average(peers.map(r => r.left));
                peers.forEach(d => {
                    d._doTranslate(baseline - d.left, 0);
                })
            } else if (["y", "top", "middle", "bottom"].includes(steps[i].channel)) {
                let baseline = average(peers.map(r => r.top));
                peers.forEach(d => {
                    d._doTranslate(0, baseline - d.top);
                })
            }
        } else {
            wd.push(item.bounds.width);
            ht.push(item.bounds.height);
        }
        if (item.type == "rect") {
            let peers = atlasSceneGraph.getPeers(item);
            let w = wd.pop(), h = ht.pop();
            let yRef = item.parent.type === "glyph" ? "bottom" : "top";
            peers.forEach(d => {
                d.resize(w, h, "left", yRef);
            })
            atlasSceneGraph._relayoutAncestors(item, peers);
        }
    }
}

var tableDrag = d3.drag()
    .on("start", function(e) {
        d3.select("#draggedTblCell").style("visibility", "visible").style("left", e.sourceEvent.clientX+"px")
            .style("top", e.sourceEvent.clientY+"px").text(d3.select(this).datum().val);
    })
    .on("drag", function(e){
        d3.select("#draggedTblCell").style("left", e.sourceEvent.clientX+"px")
            .style("top", e.sourceEvent.clientY+"px");
    })
    .on("end", function(e){
        d3.select("#draggedTblCell").style("visibility", "hidden");
        let target = d3.select(document.elementFromPoint(e.sourceEvent.clientX, e.sourceEvent.clientY)).attr("id");
        if (target === "reuseOverlay" && steps[currentStep].task === "join") {
            let col = d3.select(this).datum().col,
                item = atlasSceneGraph.getItem(steps[currentStep].item);
            for (let i = 2; i < currentStep; i++) {
                if (steps[i].field == col) {
                    alert("You have already used a " + col + " value, choose a value from a different column");
                    return;
                }
            }
            if (currentStep == 2)
                unifyRectSize();
            atlasSceneGraph.repopulate(item, atlasTbl, {field: col});  
            steps[currentStep].field = col;
            // if (steps[currentStep].xAxis)
            //     updateAxis(item, col, "x", steps[currentStep].xAxisBaseline);
            // if (steps[currentStep].yAxis)
            //     updateAxis(item, col, "y", steps[currentStep].yAxisBaseline);
            recreateAxes(currentStep);
            atlasRenderer.render(atlasSceneGraph);

            let bounds = atlasSceneGraph.bounds, margin = 15;
            d3.select("#atlasCanvas").attr("viewBox", [bounds.left - margin, bounds.top - margin, bounds.width + margin * 2, bounds.height + margin * 2].join(" "));
            d3.select("#reuseOverlay").attr("viewBox", [bounds.left - margin, bounds.top - margin, bounds.width + margin * 2, bounds.height + margin * 2].join(" "));

            highlightItem(item, 0.3);
            d3.select("#nextBtn").property("disabled", false);
        }
    });

const layerLeft = 20, layerOffset = 25, layerLineHt = 25, layerTop = 20;

function showLayers(layers) {
    layers.forEach((d, i) => d.index = i);
    const lv = d3.select("#layers");
    lv.selectAll('*').remove();
    lv.append("text").text("Layers").style("font-weight", "bold").attr("class", "layerText")
        .attr("x", 20).attr("y", 16);
    let g = lv.selectAll(".layer").data(layers.slice(1)).enter().append("g").attr("class", "layer");
    g.append("rect").attr("class", "layerRow").attr("id", d => getLayerId(d.item))
            .attr("x", 0).attr("y", d => layerTop + layerLineHt * d.index - 3)
            .attr("width", 260).attr("height", layerLineHt)
            // .on("click", (e, d) => {  
            //     highlightItem(d.item);
            // })
            ;
    g.append("image").attr("class", "layerIcon")
            .attr("x", d => layerLeft + layerOffset * d.level).attr("y", d => layerTop + layerLineHt * d.index + 2)
            .attr("href", d => "/img/"+d.item.type + ".png");
    g.append("text").attr("class", "layerText")
            .attr("x", d => layerLeft + layerOffset * d.level + 22).attr("y", d => layerTop + layerLineHt * d.index)
            .text(d => getLayerLabel(d.item));
}

function highlightItem(item, bgOpacity) {
    if (!item) {
        d3.select("#hlRect").style("visibility", "hidden");
        d3.select("#atlasCanvas").selectAll("rect").style("opacity", 1.0);
        d3.select("#layers").selectAll("rect").style("fill", "#f2f2f2");
        return;
    }
    let b = item.bounds;
    d3.select("#hlRect").style("visibility", "visible").attr("x", b.left).attr("y", b.top).attr("width", b.width).attr("height", b.height);
    let canvas = d3.select("#atlasCanvas");
    canvas.selectAll("rect").style("opacity", bgOpacity);
    updateOpacity(item, 1.0);
    d3.select("#layers").select("#"+getLayerId(item)).style("fill", "white");
}

function updateOpacity(item, o) {
    if (item.children) {
        for (let c of item.children)
            updateOpacity(c, o);
    } else {
        d3.select("#atlasCanvas").select("#"+item.id).style("opacity", o);
    }
}

function getLayerLabel (item) {
    if (item.type === "axis") {
        return item.channel.substring(0, 1).toUpperCase() + item.channel.substring(1) + " axis: " + item.field;  
    }
    let l = item.children ? item.type==="glyph" ? "glyph" : "group" : item.type;
    if (item.dataScope) {
        let peers = item.getScene().getPeers(item);
        if (peers.length > 1)
            l += " (" + peers.length + ")";
        let fields = item.dataScope.fields;
        if (item.parent && item.parent.type === "collection" && item.parent.dataScope) {
            fields = fields.filter(d => item.parent.dataScope.fields.indexOf(d) < 0);
        }
        let d = fields.join(", ");
        if (d === "atlas_rowId")
            d = "row ID";
        if (d !== "")
            l += ": " + d;
    }
    if (item.layout) {
        switch (item.layout.type) {
            case "grid":
                l = item.layout.numRows + "x" + item.layout.numCols + " grid";
                break;
            case "stack":
                l += " (" + item.layout.orientation + " stack)";
                break;
        }
    }
    return l;
};

function getLayerId (item) {
    switch (item.type) {
        case "axis":
        case "legend":
            return item.id;
        default:
            if (item.classId)
                return item.classId;
            else
                return item.id;
    }
}

function enumerateLayers(item, list, level) {
    list.push({item: item, level: level});
    if (item.children) {
        item.children.sort((a,b) => a.bounds.left - b.bounds.left);
        switch (item.type) {
            case "collection":
                enumerateLayers(item.firstChild, list, level+1);
                break;
            case "axis":
            case "legend":
            case "gridlines":
                break;
            case "glyph":
                for (let i = 0; i <= item.children.length - 1; i++) {
                    enumerateLayers(item.children[i], list, level+1);
                }
                break;
            default:
                for (let i = item.children.length - 1; i >= 0; i--) {
                    enumerateLayers(item.children[i], list, level+1);
                }
                break;
        }
    }
}

function importData() {
    document.getElementById("file").click();
    d3.select("#dialog").style("display", "inline-block");
}

function fileChanged() {
    let f = document.getElementById("file").files[0];
    const reader = new FileReader();
    reader.onload = function() {
        let t = atlas.csvFromString(reader.result, f.name);
        //check if the dataset has the needed columns and issue warning if not
        let nn = t.numericFields.length, nc = t.nonNumericFields.length;
        let warning = "Your dataset has ";
        if (nn < schema["quantitative"])
            warning +=  nn + " quantitative columns (at least " + schema["quantitative"] + " are required) ";
        if (nc < schema["categorical"])
            warning +=  nc + " categorical columns (at least " + schema["categorical"] + " are required)";
        if (warning.length > 20) {
            window.alert(warning);
            return;
        }
        loadTable(reader.result, f.name);
        
    }
    reader.readAsText(f);
}

function loadTable(text, name) {
    atlasTbl = atlas.csvFromString(text, name);
    d3.select("#dataTable").selectAll('*').remove();
    let fields = atlasTbl.fields.map(d => d);
    fields[fields.indexOf("atlas_rowId")] = "row ID";
    d3.select("#dataTable").append("thead").selectAll("th").data(fields).enter().append("th").text(d => d);
    for (let [i, row] of atlasTbl.data.entries()) {
        let tr = d3.select("#dataTable").append("tr").attr("class", i%2 === 0 ? "even" : "odd");
        for (let k in row) {
            let val = row[k];
            if (atlasTbl.getFieldType(k) == "date")
                val = atlasTbl.getRawValue(k, row[k]);
            let td = tr.append("td").datum({col: k, val: row[k]}).attr("class", "draggable").text(val);
            // if (atlasTbl.getFieldType(k) == "number")
            //     td.attr("class", "nondraggable").style("color", "#aaa");
        }
    }
    updateDialog();
    //d3.select("#dataTable").selectAll(".draggable").call(tableDrag);
}