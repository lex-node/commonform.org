var annotate = require('../utilities/annotate')
var assert = require('assert')
var clone = require('../utilities/clone')
var diff = require('commonform-diff')
var deepEqual = require('deep-equal')
var downloadForm = require('../queries/form')
var downloadFormPublications = require('../queries/form-publications')
var downloadPublication = require('../queries/publication')
var fix = require('commonform-fix-strings')
var keyarray = require('keyarray')
var merkleize = require('commonform-merkleize')
var runParallel = require('run-parallel')

module.exports = {
  namespace: 'form',

  state: {
    mode: 'read',
    error: null,
    tree: null,
    path: [],
    projects: [],
    blanks: [],
    annotations: null,
    merkle: null,
    signaturePages: [],
    focused: null
  },

  reducers: {

    mode: function (action, state) {
      return action
    },

    blank: function (action, state) {
      var blank = action.path
      var value = action.value
      var index = state.blanks
      .findIndex(function (record) {
        return deepEqual(record.blank, blank)
      })
      var newBlanks = clone(state.blanks)
      if (value === null) {
        if (index > -1) {
          newBlanks.splice(index, 1)
          return {blanks: newBlanks}
        }
      } else {
        if (index < 0) {
          newBlanks.unshift({blank: blank})
          index = 0
        }
        newBlanks[index].value = value
        return {blanks: newBlanks}
      }
    },

    comparing: function (action, state) {
      return {
        comparing: {
          tree: action.tree,
          merkle: merkleize(action.tree),
          publications: action.publications
        },
        diff: state.hasOwnProperty('tree')
        ? diff(state.tree, action.tree)
        : null
      }
    },

    focus: function (action) {
      return {focused: action.path}
    },

    signatures: function (action, state) {
      var pages = clone(state.signaturePages)
      var operand
      if (action.operation === 'push') {
        operand = action.key.length === 0
        ? pages
        : keyarray.get(pages, action.key)
        operand.push(action.value)
      } else if (action.operation === 'splice') {
        operand = keyarray.get(pages, action.key.slice(0, -1))
        operand.splice(action.key.slice(-1), 1)
      } else {
        keyarray[action.operation](pages, action.key, action.value)
      }
      return {signaturePages: pages}
    },

    tree: function (action, state) {
      var merkle = merkleize(action.tree)
      var root = merkle.digest
      window.history.pushState(action.tree, '', '/forms/' + root)
      return {
        error: null,
        tree: action.tree,
        path: [],
        projects: [],
        blanks: [],
        annotations: annotate(action.tree),
        merkle: merkleize(action.tree),
        publications: action.publications,
        signaturePages: [],
        focused: null,
        diff: state.hasOwnProperty('comparing')
        ? diff(action.tree, state.comparing.tree)
        : null
      }
    },

    error: function (action) {
      return {error: action.error}
    },

    load: function () {
      return {
        tree: null,
        annotations: null,
        merkle: null
      }
    }

  },

  effects: {

    child: function (action, state, send, done) {
      assert(Array.isArray(action.path))
      var path = action.path
      var newChild = {form: {content: ['...']}}
      var newTree = clone(state.tree)
      var array = keyarray.get(newTree, path.slice(0, -1))
      var index = path[path.length - 1]
      array.splice(index, 0, newChild)
      var payload = {
        tree: newTree,
        publications: []
      }
      send('form:tree', payload, done)
    },

    splice: function (action, state, send, done) {
      assert(Array.isArray(action.path))
      var newTree = clone(state.tree)
      var path = action.path
      var array = keyarray.get(newTree, path.slice(0, -1))
      var index = path[path.length - 1]
      array.splice(index, 1)
      fix(newTree)
      var payload = {
        tree: newTree,
        publications: []
      }
      send('form:tree', payload, done)
    },

    move: function (action, state, send, done) {
      assert(Array.isArray(action.path))
      assert(Array.isArray(state.focused))
      var fromPath = state.focused
      var toPath = action.path
      // Do not move forms within themselves.
      if (deepEqual(fromPath, toPath.slice(0, fromPath.length))) {
        done()
      } else {
        var newTree = clone(state.tree)
        var hasMoving = keyarray.get(newTree, fromPath.slice(0, -1))
        var moving = keyarray.get(newTree, fromPath)
        var hasTarget = keyarray.get(newTree, toPath.slice(0, -1))
        var fromIndex = fromPath[fromPath.length - 1]
        var toIndex = toPath[toPath.length - 1]
        hasTarget.splice(toIndex, 0, moving)
        var oldIndex = toIndex > fromIndex
        ? hasMoving.indexOf(moving)
        : hasMoving.lastIndexOf(moving)
        hasMoving.splice(oldIndex, 1)
        var payload = {
          tree: newTree,
          publications: []
        }
        send('form:tree', payload, done)
      }
    },

    heading: function (action, state, send, done) {
      var path = action.path
      var newHeading = action.heading
      var newTree = clone(state.tree)
      if (newHeading.length === 0) {
        keyarray.delete(newTree, path.concat('heading'))
      } else {
        keyarray.set(newTree, path.concat('heading'), newHeading)
      }
      var payload = {
        tree: newTree,
        publications: []
      }
      send('form:tree', payload, done)
    },

    fetch: function (action, state, send, done) {
      var digest = action.digest
      runParallel(
        [
          function (done) {
            downloadForm(digest, function (error, tree) {
              if (error) done(error)
              else done(null, tree)
            })
          },
          function (done) {
            downloadFormPublications(
              digest,
              function (error, publications) {
                if (error) done(null, [])
                else done(null, publications)
              }
            )
          }
        ],
        function (error, results) {
          if (error) done(error)
          else {
            var payload = {
              tree: results[0],
              publications: results[1]
            }
            var name = action.comparing
            ? 'form:comparing'
            : 'form:tree'
            send(name, payload, function (error) {
              if (error) done(error)
            })
          }
        })
    },

    redirectToForm: function (action, state, send, done) {
      action.edition = action.edition || 'current'
      downloadPublication(action, function (error, digest) {
        if (error) done(error)
        else window.location = '/forms/' + digest
      })
    }

  }
}