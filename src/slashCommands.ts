import {
    HttpStatusCode,
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { RcNewsApp } from '../RcNewsApp';

const GITHUB_TRENDING_ENDPOINT = 'https://github-trending-api.now.sh/repositories';

enum CommandEnum {
    Github = 'github',
    Help = 'help',
}

export class GithubTrending implements ISlashCommand {
    public command = 'trending';
    public i18nParamsExample = 'github_trending_params';
    public i18nDescription = 'github_trending_description';
    public providesPreview = false;

    constructor(private readonly app: RcNewsApp) {}

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<void> {
        const [command] = context.getArguments();

        switch (command) {
            case CommandEnum.Github:
                this.processGithubCommand(context, modify, http);
                break;
            default:
                this.processHelpCommand(context, modify);
                break;
        }
    }

    private async processHelpCommand(context: SlashCommandContext, modify: IModify): Promise<void> {
        const builder = modify.getCreator().startMessage();
        builder
            .setGroupable(false)
            .setRoom(context.getRoom())
            .setSender(context.getSender());
        const text =
            `These are the commands I can understand:
            \`/trending github\` Shows trending projects on github
            \`/trending help\` Shows this message
            `;
        builder.setText(text);

        await modify.getNotifier().notifyUser(context.getSender(), builder.getMessage());
    }

    private async processGithubCommand(context: SlashCommandContext, modify: IModify, http: IHttp): Promise<void> {
        const builder = modify.getCreator().startMessage();
        builder
            .setGroupable(false)
            .setRoom(context.getRoom())
            .setSender(context.getSender());

        builder.setText('Fetching trending projects on github...');
        await modify.getNotifier().notifyUser(context.getSender(), builder.getMessage());

        const trending = await http.get(GITHUB_TRENDING_ENDPOINT);
        if (trending.statusCode !== HttpStatusCode.OK) {
            console.error({ trending });
        }

        let message = '';

        JSON.parse(trending.content as string).forEach((item: any, index: number) => {
            message += `${index + 1}. **[${item.name}](${item.url})** by *${item.author}*\n`;
            message += `${item.description}\n`;
        });

        builder.setText(message);
        builder.setUsernameAlias('Github Trending Projects');
        builder.setAvatarUrl('https://cdnjs.cloudflare.com/ajax/libs/octicons/8.2.0/svg/mark-github.svg');

        await modify.getCreator().finish(builder);
    }
}
