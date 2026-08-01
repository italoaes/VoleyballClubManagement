# Como gerar o APK do VCM26 (Android)

O projeto já está empacotado com **Capacitor** — o app web vira um APK nativo que
roda **100% offline** no celular (não precisa hospedar nada). Só falta compilar,
o que exige **Java (JDK) + Android SDK** no seu PC.

## Pré-requisitos (instalar uma vez)

1. **Android Studio** — https://developer.android.com/studio
   - Ao instalar, aceite instalar o **Android SDK** (vem junto).
   - Isso já inclui o **JDK** embutido que o Capacitor usa.
2. Abra o Android Studio uma vez e deixe ele baixar os componentes iniciais.

Depois de instalar, confirme (feche e reabra o terminal):

```powershell
# o Android Studio instala o JDK em algo como:
# C:\Program Files\Android\Android Studio\jbr
# e o SDK em: C:\Users\<voce>\AppData\Local\Android\Sdk
```

Se `java -version` não funcionar no terminal, defina as variáveis de ambiente
(Painel de Controle → Variáveis de Ambiente):
- `JAVA_HOME` = `C:\Program Files\Android\Android Studio\jbr`
- `ANDROID_HOME` = `C:\Users\<seu-usuario>\AppData\Local\Android\Sdk`
- Adicione ao `Path`: `%JAVA_HOME%\bin`

## Caminho A — Compilar pelo Android Studio (mais fácil)

```powershell
cd game
npm run android:sync   # faz o build web e copia para o Android
npm run android:open   # abre o projeto no Android Studio
```

No Android Studio:
1. Aguarde o Gradle sincronizar (barra inferior).
2. Menu **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
3. Quando terminar, clique em **locate** — o APK estará em:
   `game/android/app/build/outputs/apk/debug/app-debug.apk`

## Caminho B — Compilar por linha de comando

```powershell
cd game
npm run android:apk
```

Isso faz o build web, sincroniza e roda o Gradle. O APK sai em:
`game/android/app/build/outputs/apk/debug/app-debug.apk`

## Instalar no celular

Opção 1 — **USB (recomendado para testar)**:
1. No celular: Configurações → Sobre → toque 7× em "Número da versão" (ativa o
   modo desenvolvedor) → ative **Depuração USB**.
2. Conecte o celular no PC via USB.
3. Com o app aberto no Android Studio, clique no botão **Run (▶)** e escolha o
   celular. Ele instala e abre o jogo direto.

Opção 2 — **Compartilhar o arquivo**:
1. Copie o `app-debug.apk` para o celular (WhatsApp, Google Drive, cabo, etc.).
2. No celular, toque no arquivo → autorize "instalar de fontes desconhecidas".

## Atualizar o app depois de mudar o código

Sempre que alterar o jogo, rode de novo:

```powershell
npm run android:sync   # rebuild + copia para o Android
```

E recompile o APK (Caminho A ou B).

## Notas

- O `appId` é `com.vcm26.volleyball` e o nome do app é **VCM26**
  (definidos em `capacitor.config.json`).
- É um **APK de debug** — perfeito para testar e instalar você mesmo. Para
  publicar na Play Store, seria preciso gerar um **AAB assinado** (passo extra).
- O ícone do app usa o ícone gerado do PWA. Para um ícone melhor, dá para gerar
  os ícones nativos com uma imagem sua depois.
