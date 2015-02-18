var Immutable = require('immutable');
var React = require('react');
var lint = require('commonform-lint');

var ButtonsBar = require('./buttons-bar');
var Form = require('./form');
var IssuesList = require('./issues-list');
var Navigation = require('./navigation');
var ProjectTitle = require('./project-title');
var Values = require('./values');
var projectStore = require('../stores/project-store');

var noPreferences = Immutable.Map();
var rootPath = Immutable.List();

module.exports = React.createClass({
  displayName: 'Project',

  componentWillMount: function() {
    var component = this;
    this.stopListening = projectStore.listen(function(newProject) {
      component.setState({project: newProject});
    });
    this.setState({project: projectStore.getInitialState()});
  },

  componentWillUnmount: function() {
    this.stopListening();
  },

  render: function() {
    var project = this.state.project;
    var form = project.get('form');
    var values = project.get('values');
    var issues = lint(form, values, noPreferences);
    return React.DOM.div({
      key: 'project',
      className: 'project'
    }, [
      React.createElement(Navigation, {
        key: 'navigation'
      }),
      React.createElement(ButtonsBar, {
        key: 'buttons',
        project: project
      }),
      React.createElement(ProjectTitle, {
        key: 'title',
        title: project.get('metadata').get('title')
      }),
      React.createElement(IssuesList, {
        key: 'issues',
        issues: issues
      }),
      React.createElement(Values, {
        key: 'values',
        values: values
      }),
      React.DOM.div({
        key: 'container',
        className: 'container'
      }, [
        React.createElement(Form, {
          key: 'form',
          form: form,
          path: rootPath
        })
      ])
    ]);
  }
});
