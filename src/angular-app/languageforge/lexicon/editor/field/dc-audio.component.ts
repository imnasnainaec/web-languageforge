import * as angular from 'angular';

import {BytesFilterFunction} from '../../../../bellows/core/filters';
import {ModalService} from '../../../../bellows/core/modal/modal.service';
import {NoticeService} from '../../../../bellows/core/notice/notice.service';
import {SessionService} from '../../../../bellows/core/session.service';
import {InterfaceConfig} from '../../../../bellows/shared/model/interface-config.model';
import {LexiconProjectService} from '../../core/lexicon-project.service';
import {Rights} from '../../core/lexicon-rights.service';
import {UploadFile, UploadResponse} from '../../shared/model/upload.model';

export class FieldAudioController implements angular.IController {
  dcFilename: string;
  dcRights: Rights;
  dcInterfaceConfig: InterfaceConfig;
  dcProjectSlug: string;

  showAudioUpload: boolean = false;

  static $inject = ['$filter', '$state',
    'Upload', 'modalService',
    'silNoticeService', 'sessionService',
    'lexProjectService'
  ];
  constructor(private $filter: angular.IFilterService, private $state: angular.ui.IStateService,
              private Upload: any, private modalService: ModalService,
              private notice: NoticeService, private sessionService: SessionService,
              private lexProjectService: LexiconProjectService) { }

  hasAudio(): boolean {
    if (this.dcFilename == null) {
      return false;
    }

    return this.dcFilename.trim() !== '';
  }

  isAtEditorEntry(): boolean {
    return this.$state.is('editor.entry');
  }

  audioPlayUrl(): string {
    let url = '';
    if (this.hasAudio()) {
      url = '/assets/lexicon/' + this.dcProjectSlug + '/audio/' + this.dcFilename;
    }

    return url;
  }

  audioDownloadUrl(): string {
    let url = '';
    if (this.hasAudio()) {
      url = '/download' + this.audioPlayUrl();
    }

    return url;
  }

  displayFilename(): string {
    return FieldAudioController.originalFileName(this.dcFilename);
  }

  deleteAudio(): void {
    if (this.hasAudio()) {
      const deleteMsg = 'Are you sure you want to delete the audio <b>\'' +
        FieldAudioController.originalFileName(this.dcFilename) + '\'</b>';
      this.modalService.showModalSimple('Delete Audio', deleteMsg, 'Cancel', 'Delete Audio')
        .then(() => {
          this.lexProjectService.removeMediaFile('audio', this.dcFilename, result => {
            if (result.ok) {
              if (result.data.result) {
                this.dcFilename = '';
              } else {
                this.notice.push(this.notice.ERROR, result.data.errorMessage);
              }
            }
          });
        }, () => { });
    }
  }

  uploadAudio(file: UploadFile): void {
    if (!file || file.$error) {
      return;
    }

    this.sessionService.getSession().then(session => {
      if (file.size > session.fileSizeMax()) {
        this.notice.push(this.notice.ERROR, '<b>' + file.name + '</b> (' +
          this.$filter<BytesFilterFunction>('bytes')(file.size) + ') is too large. It must be smaller than ' +
          this.$filter<BytesFilterFunction>('bytes')(session.fileSizeMax()) + '.');
        return;
      }

      this.notice.setLoading('Uploading ' + file.name + '...');
      this.Upload.upload({
        url: '/upload/lf-lexicon/audio',
        data: {
          file,
          previousFilename: this.dcFilename,
          projectId: session.project().id
        }
      }).then((response: UploadResponse) => {
          this.notice.cancelLoading();
          const isUploadSuccess = response.data.result;
          if (isUploadSuccess) {
            this.dcFilename = response.data.data.fileName;
            this.showAudioUpload = false;
            this.notice.push(this.notice.SUCCESS, 'File uploaded successfully.');
          } else {
            this.notice.push(this.notice.ERROR, response.data.data.errorMessage);
          }
        },

        (response: UploadResponse) => {
          this.notice.cancelLoading();
          let errorMessage = 'Upload failed.';
          if (response.status > 0) {
            errorMessage += ' Status: ' + response.status;
            if (response.statusText) {
              errorMessage += ' ' + response.statusText;
            }

            if (response.data) {
              errorMessage += '- ' + response.data;
            }
          }

          this.notice.push(this.notice.ERROR, errorMessage);
        },

        (evt: ProgressEvent) => {
          this.notice.setPercentComplete(Math.floor(100.0 * evt.loaded / evt.total));
        });
    });
  }

  // strips the timestamp file prefix (returns everything after the '_')
  private static originalFileName(filename: string) {
    if (filename == null) {
      return '';
    }

    if (!filename.trim()) {
      return filename;
    }

    return filename.substr(filename.indexOf('_') + 1);
  }

}

export const FieldAudioComponent: angular.IComponentOptions = {
  bindings: {
    dcFilename: '=',
    dcRights: '<',
    dcInterfaceConfig: '<',
    dcProjectSlug: '<'
  },
  controller: FieldAudioController,
  templateUrl: '/angular-app/languageforge/lexicon/editor/field/dc-audio.component.html'
};
