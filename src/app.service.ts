import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHello(): string {
    return `
    <head>
      <title>${this.configService.get<string>('APP_NAME', 'Nest Admin XO')}</title>
      <link rel="icon" href="/favicon.ico" type="image/x-icon">
    </head>
    <body>
      
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 5em; flex-direction: column; background: #f0f2f5; color: #333; font-family: -apple-system, sans-serif; text-align: center;">
      <div><img src="/logo.png" alt="logo" style="width: 200px; height: 200px; margin-bottom: 20px;"></div>  
      欢迎访问 ${this.configService.get<string>('APP_NAME', 'Nest Admin XO')}
        <div style="font-size: 0.4em; padding: 10px 20px; border-radius: 10px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          ${this.configService.get<string>('VERSION', '1.0.0')}
        </div>
        <div id="date" style="margin-top: 20px; font-size: 0.4em; padding: 10px 20px; border-radius: 10px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"></div>
      </div>

      <script>
      function updateTime() {
        const now = new Date();
        const el = document.getElementById('date');
        
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0'); 
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const week = ['日','一','二','三','四','五','六'][now.getDay()];
        
        el.innerHTML = year+'年'+month+'月'+day+'日 星期'+week+' '+ hours+':'+minutes+':'+seconds;
      }

      updateTime();
      setInterval(updateTime, 1000);
      </script>
    </body>`;
  }
}
