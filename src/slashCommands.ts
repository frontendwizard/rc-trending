import {
    HttpStatusCode,
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import {
    IMessage,
    IMessageAttachment,
} from '@rocket.chat/apps-engine/definition/messages';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { RcNewsApp } from '../RcNewsApp';

const GITHUB_TRENDING_ENDPOINT = 'https://github-trending-api.now.sh/repositories';
const HN_TOP_STORIES_ENDPOINT = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const getHNStoryEndpoint = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

enum CommandEnum {
    Github = 'github',
    HackerNews = 'hn',
    Help = 'help',
}

export class Trending implements ISlashCommand {
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
                this.processGithubCommand(context, modify, read, http);
                break;
            case CommandEnum.HackerNews:
                this.processHackerNewsCommand(context, modify, read, http);
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
            \`/trending hn\` Shows top10 stories on hacker news
            \`/trending help\` Shows this message
            `;
        builder.setText(text);

        await modify.getNotifier().notifyUser(context.getSender(), builder.getMessage());
    }

    private async processGithubCommand(
        context: SlashCommandContext,
        modify: IModify,
        read: IRead,
        http: IHttp,
    ): Promise<void> {
        const sender = await read.getUserReader().getById('rocket.cat');
        const room = context.getRoom();
        const builder = modify.getCreator().startMessage();
        builder
            .setGroupable(false)
            .setRoom(room)
            .setSender(sender);

        builder.setText('Fetching trending projects on github...');
        await modify.getNotifier().notifyUser(context.getSender(), builder.getMessage());

        const trending = await http.get(GITHUB_TRENDING_ENDPOINT);
        if (trending.statusCode !== HttpStatusCode.OK) {
            console.error({ trending });
            builder.setText('Error while fetching projects :(');
            await modify.getNotifier().notifyUser(context.getSender(), builder.getMessage());
        }

        const attachments: Array<IMessageAttachment> =
            JSON.parse(trending.content as string)
                .map((item: any, index: number) => ({ text: `${index + 1}. **[${item.name}](${item.url})** by *${item.author}*\n` }));

        const message: IMessage = {
            room,
            sender,
            alias: 'Github Trending Projects',
            avatarUrl: 'https://cdnjs.cloudflare.com/ajax/libs/octicons/8.2.0/svg/mark-github.svg',
            groupable: true,
            attachments,
        };

        const builderTrending = modify.getCreator().startMessage(message);
        await modify.getCreator().finish(builderTrending);
    }

    private async processHackerNewsCommand(
        context: SlashCommandContext,
        modify: IModify,
        read: IRead,
        http: IHttp,
    ): Promise<void> {
        const sender = await read.getUserReader().getById('rocket.cat');
        const room = context.getRoom();
        const builder = modify.getCreator().startMessage();
        builder
            .setGroupable(false)
            .setRoom(room)
            .setSender(sender);

        builder.setText('Fetching trending stories on hacker news...');
        await modify.getNotifier().notifyUser(context.getSender(), builder.getMessage());

        const request = await http.get(HN_TOP_STORIES_ENDPOINT);
        if (request.statusCode !== HttpStatusCode.OK) {
            console.error({ request });
            builder.setText('Error while fetching stories :(');
            await modify.getNotifier().notifyUser(context.getSender(), builder.getMessage());
        }
        let stories: Array<any> = await Promise.all(
            JSON.parse(request.content as string)
                .slice(0, 10)
                .map(async (item: number) => http.get(getHNStoryEndpoint(item)).then((response) => response.content)),
        );

        stories = stories
            .map((story: string) => JSON.parse(story))
            .map((item: any, index: number) => ({
                // tslint:disable-next-line:max-line-length
                text: `${index + 1}. **[${item.title}](${item.url || `https://news.ycombinator.com/item?id=${item.id}`})** by *${item.by}* (${item.score})\n`,
            } as IMessageAttachment));
        const message: IMessage = {
            room,
            sender,
            groupable: true,
            attachments: stories,
            alias: 'Hacker News Top Stories',
            avatarUrl: 'https://pbs.twimg.com/profile_images/1677389022/newsycbot_400x400.gif',
        };
        const builderStory = await modify.getCreator().startMessage(message);
        await modify.getCreator().finish(builderStory);
    }
}
