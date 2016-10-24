/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*/

define(function (require, exports, module) {
  'use strict';

  const _ = require('underscore');
  const $ = require('jquery');
  const AttachedClients = require('models/attached-clients');
  const Cocktail = require('cocktail');
  const Constants = require('lib/constants');
  const FormView = require('views/form');
  const preventDefaultThen = require('views/base').preventDefaultThen;
  const SettingsPanelMixin = require('views/mixins/settings-panel-mixin');
  const SignedOutNotificationMixin = require('views/mixins/signed-out-notification-mixin');
  const Strings = require('lib/strings');
  const t = require('views/base').t;
  const Template = require('stache!templates/settings/clients');
  const Url = require('lib/url');

  var DEVICE_REMOVED_ANIMATION_MS = 150;
  var UTM_PARAMS = '?utm_source=accounts.firefox.com&utm_medium=referral&utm_campaign=fxa-devices';
  var DEVICES_SUPPORT_URL = 'https://support.mozilla.org/kb/fxa-managing-devices' + UTM_PARAMS;
  var FIREFOX_DOWNLOAD_LINK = 'https://www.mozilla.org/firefox/new/' + UTM_PARAMS;
  var FIREFOX_ANDROID_DOWNLOAD_LINK = 'https://www.mozilla.org/firefox/android/' + UTM_PARAMS;
  var FIREFOX_IOS_DOWNLOAD_LINK = 'https://www.mozilla.org/firefox/ios/' +  UTM_PARAMS;
  var FORCE_DEVICE_LIST_VIEW = 'forceDeviceList';
  var FORCE_APPS_LIST_VIEW = 'forceAppsList';

  var View = FormView.extend({
    template: Template,
    className: 'clients',
    viewName: 'settings.clients',

    initialize (options) {
      this._able = options.able;
      this._attachedClients = options.attachedClients;

      if (! this._attachedClients) {
        this._attachedClients = new AttachedClients([], {
          notifier: options.notifier
        });
      }

      this.listenTo(this._attachedClients, 'add', this._onItemAdded);
      this.listenTo(this._attachedClients, 'remove', this._onItemRemoved);
    },

    _formatAccessTime (items) {
      return _.map(items, function (item) {
        if (item.lastAccessTimeFormatted) {
          item.lastAccessTimeFormatted = Strings.interpolate(
            t('Last active %(translatedTimeAgo)s'), { translatedTimeAgo: item.lastAccessTimeFormatted });
        } else {
          // unknown lastAccessTimeFormatted or not possible to format.
          item.lastAccessTimeFormatted = '';
        }
        return item;
      });
    },

    context () {
      return {
        clients: this._formatAccessTime(this._attachedClients.toJSON()),
        clientsPanelManageString: this._getManageString(),
        clientsPanelTitle: this._getPanelTitle(),
        devicesSupportUrl: DEVICES_SUPPORT_URL,
        isPanelEnabled: this._isPanelEnabled(),
        isPanelOpen: this.isPanelOpen(),
        linkAndroid: FIREFOX_ANDROID_DOWNLOAD_LINK,
        linkIOS: FIREFOX_IOS_DOWNLOAD_LINK,
        linkLinux: FIREFOX_DOWNLOAD_LINK,
        linkOSX: FIREFOX_DOWNLOAD_LINK,
        linkWindows: FIREFOX_DOWNLOAD_LINK
      };
    },

    events: {
      'click .client-disconnect': preventDefaultThen('_onDisconnectClient'),
      'click .clients-refresh': preventDefaultThen('_onRefreshClientsList')
    },

    _isPanelEnabled () {
      const account = this.user.getSignedInAccount();

      return this._able.choose('deviceListVisible', {
        forceDeviceList: Url.searchParam(FORCE_DEVICE_LIST_VIEW, this.window.location.search),
        uid: account.get('uid')
      });
    },

    _getPanelTitle () {
      var title = t('Devices');

      if (this._isAppsListVisible()) {
        title = t('Devices & apps');
      }

      return title;
    },

    _getManageString () {
      var title = t('You can manage your devices below.');

      if (this._isAppsListVisible()) {
        title = t('You can manage your devices and apps below.');
      }

      return title;
    },

    _isAppsListVisible () {
      // OAuth Apps list is visible if `appsListVisible` chooses `true`.
      return this._able.choose('appsListVisible', {
        forceAppsList: Url.searchParam(FORCE_APPS_LIST_VIEW, this.window.location.search),
        isMetricsEnabledValue: this.metrics.isCollectionEnabled()
      });
    },

    _onItemAdded () {
      this.render();
    },

    _onItemRemoved (item) {
      var id = item.get('id');
      $('#' + id).slideUp(DEVICE_REMOVED_ANIMATION_MS, () => {
        // re-render in case the last device is removed and the
        // "no registered devices" message needs to be shown.
        this.render();
      });
    },

    _onDisconnectClient (event) {
      var client = this._attachedClients.get($(event.currentTarget).data('id'));
      var clientType = client.get('clientType');
      this.logViewEvent(clientType + '.disconnect');
      // if a device then ask for confirmation
      if (clientType === Constants.CLIENT_TYPE_DEVICE) {
        this.navigate('settings/clients/disconnect', {
          clientId: client.get('id'),
          clients: this._attachedClients
        });
      } else {
        this.user.destroyAccountClient(this.user.getSignedInAccount(), client);
      }
    },

    _onRefreshClientsList () {
      if (this.isPanelOpen()) {
        this.logViewEvent('refresh');
        // only refresh devices if panel is visible
        // if panel is hidden there is no point of fetching devices
        this._fetchAttachedClients().then(() => {
          this.render();
        });
      }
    },

    openPanel () {
      this.logViewEvent('open');
      this._fetchAttachedClients();
    },

    _fetchAttachedClients () {
      return this._attachedClients.fetchClients({
        devices: true,
        oAuthApps: this._isAppsListVisible()
      }, this.user);
    }

  });

  Cocktail.mixin(
    View,
    SettingsPanelMixin,
    SignedOutNotificationMixin
  );

  module.exports = View;
});
