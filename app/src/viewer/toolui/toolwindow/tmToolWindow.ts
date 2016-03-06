interface ToolWindowScope extends ToolUIScope {
    toolWindowCtrl: ToolWindowCtrl;
}

class ToolWindowCtrl {
    static $inject = ['$scope'];
    constructor(public $scope: ToolWindowScope) {}
}
angular.module('tmaps.ui').controller('ToolWindowCtrl', ToolWindowCtrl);

angular.module('tmaps.ui')
.directive('tmToolWindow', () => {
    return {
        templateUrl: '/src/viewer/toolui/toolwindow/tool-window.html',
        controller: 'ToolWindowCtrl',
        controllerAs: 'toolWindowCtrl'
    };
})

interface ToolWindowContentScope extends ToolWindowScope {
    toolOptions: {
    };
}

angular.module('tmaps.ui')
.value('toolWindowDOMCache', {})
.directive('tmToolWindowContent',
        ['$controller', '$compile', '$templateRequest', 'toolWindowDOMCache',
        ($controller, $compile, $templateRequest, toolWindowDOMCache) => {
    return {
        restrict: 'A',
        scope: true,
        controller: ['$scope', function($scope: ToolWindowContentScope) {
        }],
        link: function(scope, elem, attr, ctrl) {
            /**
             * Watch the session set in scope and check if it changes to another session.
             * If it does then the old content of this directive should be backed up in 
             * the object toolWindowDOMCache so it can be restored later. This can be useful if
             * the tool window shows a tool result that can't simply be visualized again if the template
             * is included again by ng-include.
             */
            scope.$watch('toolUICtrl.currentSession', function(newSession: ToolSession, oldSession: ToolSession) {
                if (newSession === undefined) {
                    return;
                }
                if (oldSession !== undefined && newSession.uuid === oldSession.uuid) {
                    return;
                }

                var oldContent = elem.children().get(0);
                if (oldContent) {
                    toolWindowDOMCache[oldSession.uuid] = oldContent;
                    oldContent.remove();
                }

                var cachedDOMElement = toolWindowDOMCache[newSession.uuid];
                var hasCachedDOMElement = cachedDOMElement !== undefined;

                if (!hasCachedDOMElement) {
                    console.log(newSession.tool.templateUrl);
                    var templateUrl = newSession.tool.templateUrl;
                    $templateRequest(templateUrl).then(function(resp) {
                        var newScope = scope.$new();
                        var toolCtrl = $controller(newSession.tool.controller, {
                            'viewer': scope.viewer,
                            'tool': newSession.tool,
                            'session': newSession,
                            '$scope': newScope
                        });
                        newScope['toolCtrl'] = toolCtrl;
                        var newContent = $compile(resp)(newScope)
                        elem.append(newContent);
                    });
                } else {
                    elem.append(toolWindowDOMCache[newSession.uuid]);
                }

            });

            scope.$on('$destroy', function() {
                var currentSession = scope.toolUICtrl.currentSession;
                var currentContent = elem.children().get(0);
                if (currentContent) {
                    toolWindowDOMCache[currentSession.id] = currentContent;
                }
            });
        }
    };
}]);
