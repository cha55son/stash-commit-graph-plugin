package networkservlet;

import com.atlassian.bitbucket.auth.AuthenticationContext;
import com.atlassian.bitbucket.commit.Commit;
import com.atlassian.bitbucket.commit.CommitRequest;
import com.atlassian.bitbucket.commit.CommitService;
import com.atlassian.bitbucket.commit.graph.*;
import com.atlassian.bitbucket.repository.AbstractRefCallback;
import com.atlassian.bitbucket.repository.Ref;
import com.atlassian.bitbucket.repository.Repository;
import com.atlassian.bitbucket.repository.RepositoryService;
import com.atlassian.bitbucket.scm.ScmService;
import com.atlassian.bitbucket.user.ApplicationUser;
import com.atlassian.bitbucket.user.SecurityService;
import com.atlassian.bitbucket.util.Page;
import com.atlassian.bitbucket.util.PageUtils;
import com.atlassian.plugin.webresource.WebResourceManager;
import com.atlassian.soy.renderer.SoyException;
import com.atlassian.soy.renderer.SoyTemplateRenderer;
import com.google.common.collect.ImmutableMap;

import javax.annotation.Nonnull;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class NetworkServlet extends HttpServlet {

    static final String NETWORK_PAGE = "bitbucket.plugin.network";
    static final String NETWORK_PAGE_FRAGMENT = "bitbucket.plugin.network_fragment";

    private final AuthenticationContext authenticationContext;
    private final CommitService commitService;
    private final RepositoryService repositoryService;
    private final ScmService scmService;
    private final SecurityService securityService;
    private final SoyTemplateRenderer soyTemplateRenderer;
    private final WebResourceManager webResourceManager;

    public NetworkServlet(AuthenticationContext authenticationContext,
                          CommitService commitService,
                          RepositoryService repositoryService,
                          ScmService scmService,
                          SecurityService securityService,
                          SoyTemplateRenderer soyTemplateRenderer,
                          WebResourceManager webResourceManager) {
        this.authenticationContext = authenticationContext;
        this.commitService = commitService;
        this.repositoryService = repositoryService;
        this.scmService = scmService;
        this.securityService = securityService;
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
        final ApplicationUser user = authenticationContext.getCurrentUser();
        // Ensure we have a valid repository and user
        if (repository == null || user == null) {
            resp.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        Map<String, List<Ref>> labels = getLabels(repository);
        Page<Commit> commits = this.getCommits(repository, labels, limit, offset);

        webResourceManager.requireResource("com.plugin.commitgraph.commitgraph:commitgraph-resources");
        render(resp, (contentsOnly ? NETWORK_PAGE_FRAGMENT : NETWORK_PAGE), ImmutableMap.of(
                "repository", repository,
                "commitPage", commits,
                "labels", labels,
                "limit", limit,
                "page", (page + 1)
        ));
    }

    protected Map<String, List<Ref>> getLabels(Repository repository) {
        final Map<String, List<Ref>> labels = new HashMap<>();
        scmService.getCommandFactory(repository).heads(new AbstractRefCallback() {
            @Override
            public boolean onRef(@Nonnull Ref ref) {
                List<Ref> refs = labels.get(ref.getLatestCommit());
                if (refs == null) {
                    labels.put(ref.getLatestCommit(), refs = new ArrayList<>());
                }
                refs.add(ref);
                return true;
            }
        }).call();
        return labels;
    }

    protected Page<Commit> getCommits(final Repository repository,
                                            final Map<String, List<Ref>> labels,
                                            final Integer limit,
                                            final Integer offset) {
        final ArrayList<Commit> commits = new ArrayList<>();
        TraversalRequest request = new TraversalRequest.Builder().repository(repository).include(labels.keySet()).build();
        final ApplicationUser user = authenticationContext.getCurrentUser();
        commitService.traverse(request, new TraversalCallback() {
            private Integer counter;
            @Override
            public void onStart(@Nonnull TraversalContext context) {
                                                        this.counter = 0;
                                                                         }
            @Override
            public TraversalStatus onNode(final @Nonnull CommitGraphNode node) {
                if (counter >= offset && counter < (offset + limit)) {
                    securityService.impersonating(user, "Reading repository commits")
                        .call(() -> {
                            commits.add(commitService.getCommit(
                                    new CommitRequest.Builder(repository, node.getCommit().getId()).build()));
                            return true;
                        });
                } else if (counter >= (offset + limit)) {
                    return TraversalStatus.FINISH;
                }
                // If there are no parents then we are at the root node.
                if (node.getParents().size() > 0) {
                    counter++;
                    return TraversalStatus.CONTINUE;
                } else {
                    return TraversalStatus.FINISH;
                }
            }
        });

        // Convert the arraylist to a page
        return PageUtils.createPage(commits, PageUtils.newRequest(0, commits.size()));
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
