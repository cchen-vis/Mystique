var thisTreemapGroup = [];

function treeMapTest(basicRects, allRects) {
  let treemapGroups = [];
  allRects = allRects.filter((r) => !basicRects.includes(r));
  thisTreemapGroup = basicRects;
  horizontalExpand(basicRects, allRects);
  thisTreemapGroup = thisTreemapGroup.filter(onlyUnique);
  if (thisTreemapGroup.length === 1) verticalExpand(basicRects, allRects);
  if (thisTreemapGroup.length === 1) return false;
  let thisBbox = calculateBBox(thisTreemapGroup);
  let thisRatio = thisTreemapGroup.map(r => r.height * r.width).reduce((a,b) => a+b) / ((thisBbox.Right - thisBbox.Left) * (thisBbox.Bottom - thisBbox.Top));
  if(thisRatio < 0.98) return false;
  allRects = allRects.filter((r) => !thisTreemapGroup.includes(r));
  treemapGroups.push(thisTreemapGroup);
  while (allRects.length > 0) {
    basicRects = [allRects[0]];
    thisTreemapGroup = basicRects;
    horizontalExpand(basicRects, allRects);
    if (thisTreemapGroup.length === 1) verticalExpand(basicRects, allRects);
    if (thisTreemapGroup.length === 1 || range(thisTreemapGroup.map(r => r.width)) < 2 || range(thisTreemapGroup.map(r => r.height)) < 2) return false;
    let thisBbox = calculateBBox(thisTreemapGroup);
    thisRatio = thisTreemapGroup.map(r => r.height * r.width).reduce((a,b) => a+b) / ((thisBbox.Right - thisBbox.Left) * (thisBbox.Bottom - thisBbox.Top));
    if(thisRatio < 0.98) return false;
    allRects = allRects.filter((r) => !thisTreemapGroup.includes(r));
    treemapGroups.push(thisTreemapGroup);
  }
  return treemapFormat(treemapGroups);
}

function treemapFormat(groups) { // maybe add covering property
  return groups.map(g => {
    let thisG = {};
    thisG.Layout = "Treemap";
    thisG.rects = [...g];
    thisG.bbox = calculateBBox([...g]);
    thisG.x = Math.min(...g.map(r => r.x));
    thisG.y = Math.max(...g.map(r => r.bottom));
    thisG.collections = [];
    for (let color of g.map(r => r.fill).filter(onlyUnique)) {
      let rectOfcolor = g.filter(r => r.fill === color);
      let thisBBox = calculateBBox([...rectOfcolor]);
      let thisRatio = rectOfcolor.map(r => r.height * r.width).reduce((a,b) => a+b) / ((thisBBox.Right - thisBBox.Left) * (thisBBox.Bottom - thisBBox.Top));
      if (thisRatio >= 0.98) {
        let thisTreeColl = {};
        thisTreeColl.Layout = "Treemap";
        thisTreeColl.type = "colorGroup";
        thisTreeColl.rects = [...rectOfcolor];
        thisTreeColl.bbox = thisBBox;
        thisTreeColl.x = Math.min(...rectOfcolor.map(r => r.x));
        thisTreeColl.y = Math.max(...rectOfcolor.map(r => r.bottom));
        thisG.collections.push(thisTreeColl);
      } else {
        thisG.collections = [];
        break
      }
    }
    if (g.map(r => r.fill).filter(onlyUnique).length === 1 || thisG.collections.length === 0) delete thisG.collections;
    return thisG
  })
}

function horizontalExpand(basicRects, allRects) {
  let allNewRects = [];
  let newRectsFromOneRect;
  for (let rect of basicRects) {
    newRectsFromOneRect = [rect];
    while (true) {
      let pR = newRectsFromOneRect[newRectsFromOneRect.length - 1];
      let candidates = allRects.filter(
        (r) =>
          Math.abs(r.x - pR.right) <= 5 &&
          Math.max(r["bottom"], pR["bottom"]) - Math.min(r["y"], pR["y"]) <
            r.height + pR.height &&
          !thisTreemapGroup.includes(r) &&
          !newRectsFromOneRect.includes(r)
      );
      // candidates.sort(function (a, b) {
      //   return (
      //     Math.min(b["bottom"], pR["bottom"]) -
      //     Math.max(b["y"], pR["y"]) -
      //     (Math.min(a["bottom"], pR["bottom"]) - Math.max(a["y"], pR["y"]))
      //   );
      // });
      candidates.sort(function (a, b) {
        return (
          (a.x-pR.right)-(b.x-pR.right)
        );
      });
      if (candidates.length === 0) break;
      else {
        newRectsFromOneRect.push(candidates[0]);
      }
    }
    while (true) {
      let pR = newRectsFromOneRect[0];
      let candidates = allRects.filter(
        (r) =>
          Math.abs(r.right - pR.x) <= 5 &&
          Math.max(r["bottom"], pR["bottom"]) - Math.min(r["y"], pR["y"]) <
            r.height + pR.height &&
          !thisTreemapGroup.includes(r) &&
          !newRectsFromOneRect.includes(r)
      );
      // candidates.sort(function (a, b) {
      //   return (
      //     Math.min(b["bottom"], pR["bottom"]) -
      //     Math.max(b["y"], pR["y"]) -
      //     (Math.min(a["bottom"], pR["bottom"]) - Math.max(a["y"], pR["y"]))
      //   );
      // });
      candidates.sort(function (a, b) {
        return (
          (pR.x-a.right)-(pR.x-b.right)
        );
      });
      if (candidates.length === 0) break;
      else {
        newRectsFromOneRect.unshift(candidates[0]);
      }
    }
    allNewRects = allNewRects.concat(newRectsFromOneRect).filter(onlyUnique);
  }
  allNewRects = allNewRects.filter((r) => !basicRects.includes(r));
  if (allNewRects.length === 0) return;
  thisTreemapGroup = [...thisTreemapGroup, ...allNewRects];
  allRects = allRects.filter((r) => !allNewRects.includes(r));
  if (allRects.length > 0) verticalExpand(allNewRects, allRects);
}

function verticalExpand(basicRects, allRects) {
  let allNewRects = [];
  let newRectsFromOneRect;
  for (let rect of basicRects) {
    newRectsFromOneRect = [rect];
    while (true) {
      let pR = newRectsFromOneRect[newRectsFromOneRect.length - 1];
      let candidates = allRects.filter(
        (r) =>
          Math.abs(r.y - pR.bottom) <= 5 &&
          Math.max(r["right"], pR["right"]) - Math.min(r["x"], pR["x"]) <
            r.width + pR.width &&
          !thisTreemapGroup.includes(r) &&
          !newRectsFromOneRect.includes(r)
      );
      // candidates.sort(function (a, b) {
      //   return (
      //     Math.min(b["right"], pR["right"]) -
      //     Math.max(b["x"], pR["x"]) -
      //     (Math.min(a["right"], pR["right"]) - Math.max(a["x"], pR["x"]))
      //   );
      // });
      candidates.sort(function (a, b) {
        return (
          (a.y-pR.bottom)-(b.y-pR.bottom)
        );
      });
      if (candidates.length === 0) break;
      else {
        newRectsFromOneRect.push(candidates[0]);
      }
    }
    while (true) {
      let pR = newRectsFromOneRect[0];
      let candidates = allRects.filter(
        (r) =>
          Math.abs(r.bottom - pR.y) <= 5 &&
          Math.max(r["right"], pR["right"]) - Math.min(r["x"], pR["x"]) <
            r.width + pR.width &&
          !thisTreemapGroup.includes(r) &&
          !newRectsFromOneRect.includes(r)
      );
      // candidates.sort(function (a, b) {
      //   return (
      //     Math.min(b["right"], pR["right"]) -
      //     Math.max(b["x"], pR["x"]) -
      //     (Math.min(a["right"], pR["right"]) - Math.max(a["x"], pR["x"]))
      //   );
      // });
      candidates.sort(function (a, b) {
        return (
          (pR.y-a.bottom)-(pR.y-b.bottom)
        );
      });
      if (candidates.length === 0) break;
      else {
        newRectsFromOneRect.unshift(candidates[0]);
      }
    }
    allNewRects = allNewRects.concat(newRectsFromOneRect).filter(onlyUnique);
  }
  allNewRects = allNewRects.filter((r) => !basicRects.includes(r));
  if (allNewRects.length === 0) return;
  thisTreemapGroup = [...thisTreemapGroup, ...allNewRects];
  allRects = allRects.filter((r) => !allNewRects.includes(r));
  if (allRects.length > 0) horizontalExpand(allNewRects, allRects);
}
