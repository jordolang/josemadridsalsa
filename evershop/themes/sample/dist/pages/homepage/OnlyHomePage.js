import React from 'react';
export default function OnlyHomePage() {
    return /*#__PURE__*/ React.createElement("div", {
        className: "container mx-auto px-4 py-8 bg-gray-100 rounded-lg shadow-md mt-10"
    }, /*#__PURE__*/ React.createElement("h1", {
        className: "font-bold text-center mb-6"
    }, "Home Page Only"), /*#__PURE__*/ React.createElement("p", {
        className: " text-gray-700 text-center"
    }, "This component is only rendered on the home page."), /*#__PURE__*/ React.createElement("p", {
        className: " text-gray-700 text-center"
    }, "You can modify this component at", ' ', /*#__PURE__*/ React.createElement("code", null, "`themes/sample/src/pages/homepage/OnlyHomePage.tsx`")), /*#__PURE__*/ React.createElement("p", {
        className: " text-gray-700 text-center"
    }, "You can also remove this by disabling the theme `sample`."));
}
export const layout = {
    areaId: 'content',
    sortOrder: 10
};
