const path = require(`path`)
const { GraphQLBoolean } = require("gatsby/graphql")

exports.setFieldsOnGraphQLNodeType = ({ type }) => {
  // if the node is a markdown file, add the `published` field
  if ("MarkdownRemark" === type.name) {
    return {
      published: {
        type: GraphQLBoolean,
        resolve: ({ frontmatter }) => {
          /*
          `published` is always true in development
              so both drafts and finished posts are built
          */
          if (process.env.NODE_ENV !== "production") {
            return true
          }
          /*
          return the opposite of the `draft` value,
          i.e. if draft = true : published = false
          */
          return !frontmatter.draft
        },
      },
    }
  }
  return {}
}

exports.createPages = async ({ actions, graphql, reporter }) => {
  const { createPage } = actions

  const result = await graphql(`
    {
      pages: allPagesJson(
        filter: { path: { ne: null }, listType: { eq: null } }
      ) {
        edges {
          node {
            path
          }
        }
      }
      lists: allPagesJson(
        filter: { path: { ne: null }, listType: { ne: null } }
      ) {
        edges {
          node {
            path
            listType
          }
        }
      }
      posts: allMarkdownRemark(
        filter: { frontmatter: { path: { ne: null } } }
      ) {
        edges {
          node {
            published
            frontmatter {
              path
              type
            }
          }
        }
      }
    }
  `)

  if (result.errors) {
    reporter.panicOnBuild(`Error while running GraphQL query.`)
    return
  }

  result.data.pages.edges.forEach(({ node }) => {
    createPage({
      path: node.path,
      component: path.resolve(`src/templates/page.js`),
      context: {},
    })
  })

  result.data.posts.edges.forEach(({ node }) => {
    if (!node.published) return

    createPage({
      path: node.frontmatter.path,
      component: path.resolve(`src/templates/post.js`),
      context: {},
    })
  })

  result.data.lists.edges.forEach(({ node }) => {
    const listPageTemplate = path.resolve(`src/templates/list.js`)
    const listType = node.listType
    const allPosts = result.data.posts.edges
    const posts = allPosts.filter(
      (post) => post.node.frontmatter.type === listType
    )
    const postsPerPage = 5
    const numPages = Math.max(Math.ceil(posts.length / postsPerPage), 1)
    const slug = node.path

    Array.from({ length: numPages }).forEach((_, i) => {
      const currentPage = i + 1
      const isFirstPage = i === 0

      createPage({
        path: isFirstPage
          ? node.path
          : `${String(node.path)}/${String(currentPage)}`,
        component: listPageTemplate,
        context: {
          listType: listType,
          slug: slug,
          limit: postsPerPage,
          skip: i * postsPerPage,
          numPages: numPages,
          currentPage: currentPage,
        },
      })
    })
  })
}
