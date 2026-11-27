import { Component, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  imports: [TranslatePipe],
  selector: 'app-privacy-policy',
  styleUrl: './privacy-policy.css',
  templateUrl: './privacy-policy.html',
})
export class PrivacyPolicy{
  private readonly translate = inject(TranslateService);
}
