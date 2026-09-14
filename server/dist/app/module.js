"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const module_1 = require("../mix-source/module");
const common_1 = require("@nestjs/common");
const serve_static_1 = require("@nestjs/serve-static");
const controller_1 = require("./controller");
const service_1 = require("./service");
const node_path_1 = require("node:path");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            module_1.MixSourceModule,
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, node_path_1.join)(__dirname, '..', 'public'),
            }),
        ],
        controllers: [controller_1.AppController],
        providers: [service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=module.js.map