package networkservlet;

import com.atlassian.bitbucket.commit.Commit;
import com.atlassian.bitbucket.commit.CommitEnricher;
import com.atlassian.bitbucket.io.SingleLineOutputHandler;
import com.atlassian.bitbucket.repository.Ref;
import com.atlassian.bitbucket.repository.Repository;
import com.atlassian.bitbucket.repository.RepositoryService;
import com.atlassian.bitbucket.repository.SimpleBranch;
import com.atlassian.bitbucket.repository.SimpleTag;
import com.atlassian.bitbucket.scm.CommitsCommandParameters;
import com.atlassian.bitbucket.scm.git.GitScm;
import com.atlassian.bitbucket.scm.git.command.GitCommand;
import com.atlassian.bitbucket.scm.git.command.GitScmCommandBuilder;
import com.atlassian.bitbucket.util.Page;
import com.atlassian.bitbucket.util.PageRequest;
import com.atlassian.bitbucket.util.PageRequestImpl;
import com.atlassian.bitbucket.util.PageUtils;
import com.atlassian.plugin.webresource.WebResourceManager;
import com.atlassian.soy.renderer.SoyException;
import com.atlassian.soy.renderer.SoyTemplateRenderer;
import com.google.common.collect.ImmutableMap;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class NetworkServlet extends HttpServlet {

    static final String NETWORK_PAGE = "bitbucket.plugin.network";
    static final String NETWORK_PAGE_FRAGMENT = "bitbucket.plugin.network_fragment";

    private final RepositoryService repositoryService;
    private final CommitEnricher commitEnricher;
    private final GitScm gitScm;
    private final SoyTemplateRenderer soyTemplateRenderer;
    private final WebResourceManager webResourceManager;

    public NetworkServlet(RepositoryService repositoryService,
                          CommitEnricher commitEnricher,
                          GitScm gitScm,
                          SoyTemplateRenderer soyTemplateRenderer,
                          WebResourceManager webResourceManager) {
        this.repositoryService = repositoryService;
        this.commitEnricher = commitEnricher;
        this.gitScm = gitScm;
        this.soyTemplateRenderer = soyTemplateRenderer;
        this.webResourceManager = webResourceManager;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        // Get repoSlug from path
        String pathInfo = req.getPathInfo();
        String[] components = pathInfo.split("/");
        Boolean contentsOnly = !(req.getParameter("contentsOnly") == null);
        String pageStr = req.getParameter("page");
        Integer page = Math.max(Integer.parseInt(pageStr == null ? "0" : pageStr), 1) - 1;
        final Integer limit = 50;
        final Integer offset = page * limit;

        if (components.length < 3) {
            resp.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        final Repository repository = repositoryService.getBySlug(components[1], components[2]);
        if (repository == null) {
            resp.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        Map<String, List<Ref>> labels = this.getLabels(repository);
        Page<Commit> commits = this.getCommits(repository, limit, offset);

        webResourceManager.requireResource("com.plugin.commitgraph.commitgraph:commitgraph-resources");
        render(resp, (contentsOnly ? NETWORK_PAGE_FRAGMENT : NETWORK_PAGE), ImmutableMap.of(
                "repository", repository,
                "commitPage", commits,
                "labels", labels,
                "limit", limit,
                "page", (page + 1)
        ));
    }

    protected Map<String, List<Ref>> getLabels(Repository repository) throws IOException {
        final Map<String, List<Ref>> labels = new HashMap<>();
        SingleLineOutputHandler sloh = new SingleLineOutputHandler();
        GitScmCommandBuilder showRef = gitScm.getCommandBuilderFactory().builder( repository ).command("show-ref");
        showRef.argumentAt(0, "--heads" );
        showRef.argumentAt(1, "--tags" );
        showRef.argumentAt(2, "--dereference");
        GitCommand<String> showRefCmd = showRef.build(sloh);
        String result = showRefCmd.synchronous().call();
        if (result != null) {
            StringReader r = new StringReader(result);
            BufferedReader br = new BufferedReader(r);
            String line;

            // Loop through 1st time to construct ArrayLists.
            while ((line = br.readLine()) != null) {
                if (line.length() > 40) {
                    String hash = line.substring(0, 40);
                    labels.put(hash, new ArrayList<>());
                }
            }

            // Loop through a 2nd time to fill them.
            r = new StringReader(result);
            br = new BufferedReader(r);
            while ((line = br.readLine()) != null) {
                if (line.length() > 40) {
                    Ref ref;
                    String hash = line.substring(0, 40);
                    String id = line.substring(41).trim();
                    if (id.endsWith("^{}")) {
                        id = id.substring(0, id.length() - 3);
                    }
                    if (id.startsWith("refs/tags/")) {
                        String displayId = id.substring("refs/tags/".length());
                        ref = new SimpleTag.Builder().hash(hash).displayId(displayId).id(id).latestCommit(hash).build();
                    } else {
                        String displayId = id.substring("refs/heads/".length());
                        ref = new SimpleBranch.Builder().displayId(displayId).id(id).latestCommit(hash).build();
                    }
                    labels.get(hash).add(ref);
                }
            }
        }
        return labels;
    }

    protected Page<Commit> getCommits(final Repository repository,
                                            final Integer limit,
                                            final Integer offset) {
        PageRequest pr = new PageRequestImpl( offset, limit );
        pr = pr.buildRestrictedPageRequest( 50 );
        CommitsCommandParameters ccp = new CommitsCommandParameters.Builder().all( true ).build();
        PagedCommitOutputHandler pcoh = new PagedCommitOutputHandler( repository, ccp, pr );
        GitScmCommandBuilder revList = gitScm.getCommandBuilderFactory().builder(repository).command("rev-list");
        revList.argumentAt(0, "--pretty=" + pcoh.getCommitReader().getFormat() );
        revList.argumentAt(1, "--branches=*" );
        revList.argumentAt(2, "--tags=*" );
        revList.argumentAt(3, "--topo-order" );
        GitCommand<Page<Commit>> revListCmd = revList.build(pcoh);
        Page<Commit> commits = revListCmd.synchronous().call();
        if ( commits == null ) {
            commits = PageUtils.createEmptyPage( pr );
        } else {
            commits = commitEnricher.enrichPage(repository, commits, Collections.<String>emptySet());
        }
        return commits;
    }

    protected void render(HttpServletResponse resp, String templateName, Map<String, Object> data) throws IOException, ServletException {
        resp.setContentType("text/html;charset=UTF-8");
        try {
            soyTemplateRenderer.render(
                resp.getWriter(),
                "com.plugin.commitgraph.commitgraph:network-soy-templates",
                templateName,
                data
            );
        } catch (SoyException e) {
            Throwable cause = e.getCause();
            if (cause instanceof IOException) {
                throw (IOException) cause;
            }
            throw new ServletException(e);
        }
    }
}
