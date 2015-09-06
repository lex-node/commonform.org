var h = require('virtual-dom/h')
var postForm = require('../utility/post-form')

var message = 'Are you sure you want to share this form with commonform.org?'

function shareButton(state) {
  var form = state.form
  return h('button.share',
    { onclick: function(event) {
        event.preventDefault()
        event.stopPropagation()
        if (window.confirm(message)) {
          postForm(form, function(error) {
            if (error) {
              window.alert(error) }
            else {
              window.alert('Shared!') } }) } } },
    'Share') }

module.exports = shareButton